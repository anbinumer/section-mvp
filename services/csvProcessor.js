const Papa = require('papaparse');
const CanvasAPI = require('./canvasAPI');
const AllocationService = require('./allocationService');

class CsvProcessor {
  constructor() {
    this.maxFileSize = 1024 * 1024; // 1MB limit for MVP
    this.maxRows = 2000; // Conservative limit for MVP
    this.allocationService = new AllocationService();
  }

  /**
   * Generate unified CSV template with current course data following Canvas SIS sections.csv format
   */
  async generateTemplate(canvasUrl, apiToken, courseId) {
    try {
      const canvasAPI = new CanvasAPI(canvasUrl, apiToken);
      
      // Get course data
      const [course, students, facilitators, sections] = await Promise.all([
        canvasAPI.getCourse(courseId),
        canvasAPI.getStudents(courseId),
        canvasAPI.getFacilitators(courseId),
        canvasAPI.getSections(courseId)
      ]);

      return this.generateUnifiedTemplate(course, students, facilitators, sections);
    } catch (error) {
      throw new Error(`Template generation failed: ${error.message}`);
    }
  }

  /**
   * Generate unified template following Canvas SIS sections.csv format
   * Shows current state including ALL sections (tool + non-tool) and allows bulk changes
   */
  generateUnifiedTemplate(course, students, facilitators, sections) {
    // Canvas SIS sections.csv format headers with additional context
    const headers = [
      'section_id',        // SIS section ID  
      'course_id',         // SIS course ID
      'name',             // Section name
      'status',           // active/deleted
      'start_date',       // Optional
      'end_date',         // Optional
      'student_id',       // Student SIS ID (our extension)
      'student_name',     // Student name (our extension)
      'student_email',    // Student email for reference (our extension)
      'facilitator_email', // Facilitator email (our extension)
      'section_type',     // tool_created/existing/default (our extension)
      'campus_info',      // Campus/location info extracted from section name (our extension)
      'operation'         // create_section/enroll_student/move_student (our extension)
    ];

    const data = [];
    
    // Separate tool-created from existing sections
    const toolSections = sections.filter(section => this.isToolCreatedSection(section));
    const existingSections = sections.filter(section => !this.isToolCreatedSection(section));
    
    // 1. Show ALL existing sections (including default) with current enrollments
    // This provides context for campus-based grouping and section understanding
    sections.forEach(section => {
      const sectionStudents = students.filter(student => {
        return student.enrollments?.some(enrollment => 
          enrollment.course_section_id == section.id && 
          enrollment.enrollment_state === 'active'
        );
      });

      const isToolCreated = this.isToolCreatedSection(section);
      const sectionType = isToolCreated ? 'tool_created' : 
                         (section.name.toLowerCase().includes('default') ? 'default' : 'existing');
      
      // Extract potential campus info from section name
      const campusInfo = this.extractCampusInfo(section.name);

      if (sectionStudents.length > 0) {
        sectionStudents.forEach(student => {
          data.push({
            section_id: section.sis_section_id || `existing_${section.id}`,
            course_id: course.sis_course_id || course.id,
            name: section.name,
            status: 'active',
            start_date: '',
            end_date: '',
            student_id: student.sis_user_id || student.id,
            student_name: student.name || student.sortable_name,
            student_email: student.email || '',
            facilitator_email: '',
            section_type: sectionType,
            campus_info: campusInfo,
            operation: isToolCreated ? 'current_enrollment' : 'existing_enrollment'
          });
        });
      } else {
        // Section with no students - still show for context
        data.push({
          section_id: section.sis_section_id || `existing_${section.id}`,
          course_id: course.sis_course_id || course.id,
          name: section.name,
          status: 'active',
          start_date: '',
          end_date: '',
          student_id: '',
          student_name: '',
          student_email: '',
          facilitator_email: '',
          section_type: sectionType,
          campus_info: campusInfo,
          operation: isToolCreated ? 'existing_section' : 'readonly_section'
        });
      }
    });

    // 2. Show unassigned students (can be assigned to new/existing sections)
    const unassignedStudents = this.allocationService.getUnassignedStudents(students, sections);
    
    // Group unassigned students by potential campus (if email domain suggests campus)
    const campusGroups = this.groupStudentsByCampus(unassignedStudents);
    
    Object.entries(campusGroups).forEach(([campus, campusStudents], groupIndex) => {
      campusStudents.forEach((student, studentIndex) => {
        // Suggest section name based on campus grouping
        const suggestedSectionName = campus !== 'unknown' ? 
          `New Section ${campus} ${String.fromCharCode(65 + groupIndex)}` : 
          `New Section ${String.fromCharCode(65 + groupIndex)}`;
          
        data.push({
          section_id: `NEW_SECTION_${campus.toUpperCase()}_${String.fromCharCode(65 + groupIndex)}`,
          course_id: course.sis_course_id || course.id,
          name: suggestedSectionName,
          status: 'active',
          start_date: '',
          end_date: '',
          student_id: student.sis_user_id || student.id,
          student_name: student.name || student.sortable_name,
          student_email: student.email || '',
          facilitator_email: facilitators.length > 0 ? facilitators[0].email || '' : '',
          section_type: 'new_section',
          campus_info: campus,
          operation: 'create_and_enroll'
        });
      });
    });

    return {
      filename: `${course.course_code || course.id}_sections_bulk_template.csv`,
      content: Papa.unparse({ fields: headers, data: data }),
      instructions: this.getUnifiedInstructions(),
      summary: {
        existingSections: existingSections.length,
        toolCreatedSections: toolSections.length,
        totalStudents: students.length,
        unassignedStudents: unassignedStudents.length,
        availableFacilitators: facilitators.length,
        campusGroups: Object.keys(campusGroups)
      }
    };
  }

  /**
   * Check if section was created by our tool
   */
  isToolCreatedSection(section) {
    // Check SIS section ID prefix
    if (section.sis_section_id && section.sis_section_id.startsWith('ACU_SM_')) {
      return true;
    }
    
    // Check integration_id for our tool metadata
    if (section.integration_id) {
      try {
        const metadata = JSON.parse(section.integration_id);
        return metadata.tool === 'ACU_Section_Manager';
      } catch (e) {
        // If integration_id contains our tool name but isn't JSON
        return section.integration_id.includes('ACU_Section_Manager');
      }
    }
    
    return false;
  }

  /**
   * Extract campus information from section name
   */
  extractCampusInfo(sectionName) {
    const campusPatterns = [
      /blacktown/i,
      /strathfield/i,
      /north sydney/i,
      /melbourne/i,
      /brisbane/i,
      /canberra/i,
      /ballarat/i,
      /online/i,
      /zoom/i,
      /campus/i
    ];

    for (const pattern of campusPatterns) {
      const match = sectionName.match(pattern);
      if (match) {
        return match[0].toLowerCase();
      }
    }

    // Check for section naming patterns that might indicate grouping
    if (/section [a-z]/i.test(sectionName)) {
      return 'grouped';
    }

    return 'unknown';
  }

  /**
   * Group students by potential campus based on email domain or other indicators
   */
  groupStudentsByCampus(students) {
    const groups = { unknown: [] };

    students.forEach(student => {
      let campus = 'unknown';
      
      // Try to determine campus from email domain
      if (student.email) {
        const email = student.email.toLowerCase();
        if (email.includes('blacktown')) campus = 'blacktown';
        else if (email.includes('strathfield')) campus = 'strathfield';
        else if (email.includes('melbourne')) campus = 'melbourne';
        else if (email.includes('brisbane')) campus = 'brisbane';
        else if (email.includes('canberra')) campus = 'canberra';
        else if (email.includes('ballarat')) campus = 'ballarat';
      }

      if (!groups[campus]) {
        groups[campus] = [];
      }
      groups[campus].push(student);
    });

    return groups;
  }

  /**
   * Parse and validate uploaded CSV file
   */
  async parseAndValidate(fileBuffer, operation, canvasUrl, apiToken, courseId) {
    try {
      // File size validation
      if (fileBuffer.length > this.maxFileSize) {
        throw new Error(`File size (${Math.round(fileBuffer.length / 1024)}KB) exceeds limit of ${Math.round(this.maxFileSize / 1024)}KB`);
      }

      // Parse CSV
      const csvContent = fileBuffer.toString('utf8');
      const parseResult = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase()
      });

      if (parseResult.errors.length > 0) {
        throw new Error(`CSV parsing errors: ${parseResult.errors.map(e => e.message).join(', ')}`);
      }

      const data = parseResult.data;
      
      // Row count validation
      if (data.length > this.maxRows) {
        throw new Error(`Too many rows (${data.length}). Maximum allowed: ${this.maxRows}`);
      }

      if (data.length === 0) {
        throw new Error('CSV file is empty or contains no valid data rows');
      }

      // Validate structure based on operation type
      const validation = await this.validateCsvStructure(data, operation, canvasUrl, apiToken, courseId);
      
      return {
        success: validation.valid,
        data: data,
        validation: validation,
        summary: {
          totalRows: data.length,
          validRows: validation.validRows,
          errorRows: validation.errorRows,
          warningRows: validation.warningRows
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null,
        validation: null
      };
    }
  }

  /**
   * Validate CSV structure and data
   */
  async validateCsvStructure(data, operation, canvasUrl, apiToken, courseId) {
    const validation = {
      valid: true,
      validRows: 0,
      errorRows: 0,
      warningRows: 0,
      errors: [],
      warnings: [],
      rowValidations: [],
      deletionWarnings: []
    };

    const canvasAPI = new CanvasAPI(canvasUrl, apiToken);

    // Get Canvas data for validation
    let canvasData = {};
    try {
      const [students, facilitators, sections] = await Promise.all([
        canvasAPI.getStudents(courseId),
        canvasAPI.getFacilitators(courseId),
        canvasAPI.getSections(courseId)
      ]);
      
      canvasData = { students, facilitators, sections };
    } catch (error) {
      validation.errors.push(`Failed to fetch Canvas data for validation: ${error.message}`);
      validation.valid = false;
      return validation;
    }

    // NEW: Detect missing tool-created sections
    const missingToolSections = await this.detectMissingToolSections(data, canvasData, canvasAPI);
    if (missingToolSections.length > 0) {
      validation.deletionWarnings = missingToolSections;
      
      const totalAffectedStudents = missingToolSections.reduce((sum, section) => sum + section.studentCount, 0);
      
      validation.warnings.push({
        type: 'missing_tool_sections',
        severity: 'high',
        message: `${missingToolSections.length} tool-created section(s) missing from CSV`,
        details: `${totalAffectedStudents} students will remain in sections you may have intended to delete`,
        sections: missingToolSections.map(s => `${s.name} (${s.studentCount} students)`),
        action: 'CURRENT BEHAVIOR: These sections and students will remain unchanged. To delete sections, see options below.',
        recommendedActions: [
          'Option 1: Keep rows and set status="deleted" for explicit deletion',
          'Option 2: Upload with deletion mode enabled (requires confirmation)',
          'Option 3: Use main UI to delete sections individually'
        ]
      });
    }

    // Validate each row
    data.forEach((row, index) => {
      const rowNumber = index + 2; // Account for header row
      const rowValidation = this.validateRow(row, operation, canvasData, rowNumber);
      
      validation.rowValidations.push(rowValidation);
      
      if (rowValidation.errors.length > 0) {
        validation.errorRows++;
        validation.errors.push(...rowValidation.errors);
      } else {
        validation.validRows++;
      }
      
      if (rowValidation.warnings.length > 0) {
        validation.warningRows++;
        validation.warnings.push(...rowValidation.warnings);
      }
    });

    // Overall validation
    if (validation.errorRows > 0) {
      validation.valid = false;
    }

    return validation;
  }

  /**
   * Detect tool-created sections that are missing from the CSV data
   */
  async detectMissingToolSections(csvData, canvasData, canvasAPI) {
    const missingToolSections = [];
    
    // Get all tool-created sections from Canvas
    const toolSections = canvasData.sections.filter(section => this.isToolCreatedSection(section));
    console.log(`🔍 [DEBUG] Found ${toolSections.length} tool-created sections in Canvas:`);
    toolSections.forEach(section => {
      console.log(`  - ${section.name} (ID: ${section.id}, SIS: ${section.sis_section_id})`);
    });
    
    console.log(`🔍 [DEBUG] Checking against ${csvData.length} CSV rows`);
    
    // Check which tool-created sections are missing from CSV
    for (const toolSection of toolSections) {
      console.log(`🔍 [DEBUG] Checking if section ${toolSection.name} (${toolSection.id}) is in CSV...`);
      
      const sectionInCSV = csvData.some(row => {
        const match = (
          row.section_id === toolSection.id.toString() ||
          row.section_id === toolSection.sis_section_id ||
          (row.name && row.name.toLowerCase() === toolSection.name.toLowerCase())
        );
        
        if (match) {
          console.log(`  ✅ Found in CSV: row.section_id=${row.section_id}, row.name=${row.name}`);
        }
        return match;
      });
      
      if (!sectionInCSV) {
        console.log(`  ❌ NOT found in CSV - marking as missing`);
        
        // Get student count for this section
        try {
          const enrollments = await canvasAPI.getSectionEnrollments(toolSection.id);
          const studentCount = enrollments.filter(e => e.type === 'StudentEnrollment' && e.enrollment_state === 'active').length;
          
          console.log(`  📊 Section has ${studentCount} active students`);
          
          missingToolSections.push({
            id: toolSection.id,
            name: toolSection.name,
            sis_section_id: toolSection.sis_section_id,
            studentCount: studentCount,
            students: enrollments
              .filter(e => e.type === 'StudentEnrollment' && e.enrollment_state === 'active')
              .map(e => ({ id: e.user_id, name: e.user?.name || 'Unknown' }))
          });
        } catch (error) {
          console.warn(`Could not get enrollments for section ${toolSection.id}: ${error.message}`);
          missingToolSections.push({
            id: toolSection.id,
            name: toolSection.name,
            sis_section_id: toolSection.sis_section_id,
            studentCount: 0,
            students: []
          });
        }
      } else {
        console.log(`  ✅ Section found in CSV - will not be deleted`);
      }
    }
    
    console.log(`🔍 [DEBUG] Final result: ${missingToolSections.length} missing sections detected`);
    missingToolSections.forEach(section => {
      console.log(`  - ${section.name} (${section.studentCount} students)`);
    });
    
    return missingToolSections;
  }

  /**
   * Validate individual CSV row
   */
  validateRow(row, operation, canvasData, rowNumber) {
    const rowValidation = {
      rowNumber,
      errors: [],
      warnings: []
    };

    switch (operation) {
      case 'bulk-operations':
        this.validateBulkOperationRow(row, canvasData, rowValidation);
        break;
      default:
        rowValidation.errors.push(`Unknown operation type: ${operation}`);
    }

    return rowValidation;
  }

  /**
   * Validate bulk operation row following Canvas SIS format with enhanced campus context
   */
  validateBulkOperationRow(row, canvasData, rowValidation) {
    // Required fields validation
    if (!row.section_id || row.section_id.trim() === '') {
      rowValidation.errors.push('section_id is required');
    }

    if (!row.name || row.name.trim() === '') {
      rowValidation.errors.push('Section name is required');
    }

    if (!row.status || !['active', 'deleted'].includes(row.status)) {
      rowValidation.errors.push('Status must be "active" or "deleted"');
    }

    // CRITICAL: Cross-reference actual Canvas data to prevent section_type tampering
    const actualSection = this.findActualSectionFromCanvasData(row, canvasData);
    const actualSectionType = this.determineActualSectionType(actualSection, canvasData);
    
    // Section type validation and modification rules
    if (row.section_type) {
      if (!['tool_created', 'existing', 'default', 'new_section'].includes(row.section_type)) {
        rowValidation.errors.push('Invalid section_type');
      }

      // SECURITY CHECK: Prevent section_type tampering
      if (actualSection && actualSectionType !== row.section_type) {
        rowValidation.errors.push(
          `SECURITY: section_type tampering detected. Actual type: ${actualSectionType}, attempted: ${row.section_type}. Cannot modify section type.`
        );
      }

      // Validate modification permissions based on ACTUAL section type (not user-provided)
      const effectiveSectionType = actualSection ? actualSectionType : row.section_type;
      
      if (effectiveSectionType === 'existing' || effectiveSectionType === 'default') {
        if (row.operation === 'create_and_enroll' || row.status === 'deleted') {
          rowValidation.errors.push('Cannot modify existing/default sections - these are read-only');
        }
        
        // Moving students FROM existing sections is not allowed via CSV
        if (row.operation === 'current_enrollment' && row.student_id) {
          rowValidation.warnings.push('Cannot move students from existing/default sections via CSV - use main UI instead');
        }
        
        // Check for any attempt to modify existing section names
        if (actualSection && row.name !== actualSection.name) {
          rowValidation.errors.push(
            `Cannot rename existing/default section "${actualSection.name}" to "${row.name}". Use main UI to move students to new sections instead.`
          );
        }
        
        // Check for any attempt to modify existing section IDs
        if (actualSection && row.section_id !== actualSection.id.toString() && 
            row.section_id !== actualSection.sis_section_id) {
          rowValidation.errors.push(
            `Cannot change section_id for existing/default sections. Original: ${actualSection.id}, attempted: ${row.section_id}`
          );
        }
      }
    }

    // Student validation (if student data is present)
    if (row.student_id && row.student_id.trim() !== '') {
      const studentExists = canvasData.students.some(s => 
        s.id == row.student_id || s.sis_user_id == row.student_id
      );
      if (!studentExists) {
        rowValidation.errors.push('Student ID not found in course');
      }
    }

    // Facilitator email validation
    if (row.facilitator_email && row.facilitator_email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(row.facilitator_email)) {
        rowValidation.errors.push('Invalid facilitator email format');
      } else {
        // Check if facilitator exists in Canvas
        const facilitatorExists = canvasData.facilitators.some(f => 
          f.email && f.email.toLowerCase() === row.facilitator_email.toLowerCase()
        );
        if (!facilitatorExists) {
          rowValidation.warnings.push('Facilitator email not found in course - section will be created without assigned facilitator');
        }
      }
    }

    // Section name conflict validation for new sections
    if (row.section_id.startsWith('NEW_') && row.operation === 'create_and_enroll') {
      const nameConflict = canvasData.sections.some(s => 
        s.name.toLowerCase() === row.name.trim().toLowerCase()
      );
      if (nameConflict) {
        rowValidation.errors.push('Section name already exists in course');
      }
    }

    // Operation validation
    if (row.operation) {
      const validOperations = [
        'current_enrollment', 'existing_enrollment', 'readonly_section', 
        'create_and_enroll', 'existing_section'
      ];
      if (!validOperations.includes(row.operation)) {
        rowValidation.errors.push(`Invalid operation: ${row.operation}`);
      }

      // Readonly operations should not be modified
      if (row.operation === 'readonly_section' || row.operation === 'existing_enrollment') {
        if (row.status === 'deleted') {
          rowValidation.errors.push('Cannot delete readonly sections');
        }
      }
    }

    // Date validation (if provided)
    if (row.start_date && row.start_date.trim() !== '') {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(row.start_date)) {
        rowValidation.errors.push('start_date must be in YYYY-MM-DD format');
      }
    }

    if (row.end_date && row.end_date.trim() !== '') {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(row.end_date)) {
        rowValidation.errors.push('end_date must be in YYYY-MM-DD format');
      }
    }

    // Campus info validation (informational)
    if (row.campus_info && row.campus_info !== 'unknown') {
      rowValidation.warnings.push(`Campus detected: ${row.campus_info} - use for logical grouping`);
    }
  }

  /**
   * Find the actual Canvas section that corresponds to a CSV row
   */
  findActualSectionFromCanvasData(row, canvasData) {
    // Skip NEW_ sections as they don't exist in Canvas yet
    if (row.section_id.startsWith('NEW_')) {
      return null;
    }

    // Try to find by section ID (numeric or SIS ID)
    const sectionById = canvasData.sections.find(s => 
      s.id.toString() === row.section_id || s.sis_section_id === row.section_id
    );
    
    if (sectionById) {
      return sectionById;
    }

    // Try to find by section name as fallback (less reliable)
    const sectionByName = canvasData.sections.find(s => 
      s.name.toLowerCase() === row.name.toLowerCase()
    );
    
    return sectionByName || null;
  }

  /**
   * Determine the actual section type based on Canvas data
   */
  determineActualSectionType(section, canvasData) {
    if (!section) {
      return 'new_section'; // Doesn't exist in Canvas
    }

    // Check if it's a tool-created section
    if (this.isToolCreatedSection(section)) {
      return 'tool_created';
    }

    // Check if it's the default section
    if (section.name.toLowerCase().includes('default') || 
        section.name === canvasData.course?.name || 
        section.default_section === true) {
      return 'default';
    }

    // Everything else is an existing section
    return 'existing';
  }

  /**
   * Get instruction text for unified template
   */
  getUnifiedInstructions() {
    return `
CANVAS SECTION MANAGEMENT - BULK OPERATIONS CSV

This CSV shows your COMPLETE course state including ALL sections and allows bulk changes following Canvas SIS sections.csv format.

COLUMN DESCRIPTIONS:
• section_id: SIS section identifier (existing sections show current ID, new sections use NEW_SECTION_X)
• course_id: Course SIS ID (pre-filled, don't change)
• name: Section display name (edit for new sections only)
• status: active/deleted (use 'deleted' to remove TOOL-CREATED sections only)
• start_date/end_date: Optional section dates (YYYY-MM-DD format)
• student_id: Student SIS ID (don't change)
• student_name: Student name (for reference, don't change)
• student_email: Student email (for reference, don't change)
• facilitator_email: Email of section facilitator (optional)
• section_type: tool_created/existing/default/new_section (shows section origin)
• campus_info: Campus/location extracted from section name (for grouping context)
• operation: Type of change (see below)

SECTION TYPES & WHAT YOU CAN DO:
• tool_created: Sections created by this tool (CAN modify students, facilitators, delete)
• existing: Manually created sections (READ-ONLY - shows context for campus grouping)
• default: Default course section (READ-ONLY - shows current assignments)
• new_section: New sections to create (MODIFY - change names, assignments)

OPERATION TYPES:
• current_enrollment: Tool-created section student assignments (CAN move to different sections)
• existing_enrollment: Existing section assignments (READ-ONLY - for context)
• readonly_section: Shows existing sections (CONTEXT ONLY - cannot modify)
• create_and_enroll: Create new section and enroll student (MODIFY)

HOW TO MAKE CHANGES:
1. CREATE NEW SECTIONS: Modify NEW_SECTION_X rows - change section_id, name, facilitator_email
2. MOVE STUDENTS: Change section_id and name for students from tool_created sections
3. CAMPUS GROUPING: Use campus_info column to group students from same campus
4. DELETE SECTIONS: Set status to 'deleted' for tool_created sections only
5. ASSIGN FACILITATORS: Add facilitator_email to any sections

CAMPUS-BASED SECTION CREATION:
• Use existing section context to understand campus distribution
• campus_info column shows detected campus/location information
• Group students by campus when creating new sections
• Example: Students from 'blacktown' campus can be grouped into 'Blacktown Section A'

IMPORTANT RULES:
• ONLY tool_created sections can be modified or deleted
• existing/default sections are READ-ONLY (shown for context)
• Don't change student_id, student_name, student_email columns
• Section names must be unique within the course
• Facilitator emails must match Canvas users exactly

SECURITY PROTECTION:
• section_type values are LOCKED to actual Canvas data - cannot be changed
• section_id values for existing sections are LOCKED - cannot be changed  
• Section names for existing/default sections are LOCKED - cannot be changed
• Any attempt to tamper with these values will result in validation errors
• Save as CSV format when uploading
• Maximum file size: 1MB

CAMPUS INFORMATION:
The tool automatically detects campus information from section names and student emails.
Use this context to create logical groupings (e.g., all Blacktown students in Blacktown sections).

CANVAS SIS COMPATIBILITY:
This template follows Canvas SIS sections.csv format for proper integration.
    `.trim();
  }
}

module.exports = CsvProcessor; 