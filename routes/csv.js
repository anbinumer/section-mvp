const express = require('express');
const multer = require('multer');
const router = express.Router();
const CsvProcessor = require('../services/csvProcessor');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024, // 1MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

// GET /api/csv/template
// Generate and download unified CSV template
router.get('/template', async (req, res) => {
  try {
    const { courseId, canvasUrl, apiToken } = req.query;

    if (!courseId || !canvasUrl || !apiToken) {
      return res.status(400).json({
        error: 'Course ID, Canvas URL, and API token are required as query parameters'
      });
    }

    console.log(`📋 Generating unified bulk operations template for course ${courseId}`);

    const csvProcessor = new CsvProcessor();
    const template = await csvProcessor.generateTemplate(canvasUrl, apiToken, courseId);

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${template.filename}"`);
    res.setHeader('X-Template-Instructions', Buffer.from(template.instructions).toString('base64'));
    res.setHeader('X-Template-Summary', Buffer.from(JSON.stringify(template.summary)).toString('base64'));

    res.send(template.content);

  } catch (error) {
    console.error('❌ Template generation error:', error);
    res.status(500).json({
      error: 'Template generation failed',
      message: error.message
    });
  }
});

// POST /api/csv/validate
// Validate uploaded CSV file for bulk operations
router.post('/validate', upload.single('csvFile'), async (req, res) => {
  try {
    const { operation, courseId, canvasUrl, apiToken, deletionMode } = req.body;

    if (!req.file) {
      return res.status(400).json({
        error: 'CSV file is required'
      });
    }

    if (!operation || !courseId || !canvasUrl || !apiToken) {
      return res.status(400).json({
        error: 'Operation type, course ID, Canvas URL, and API token are required'
      });
    }

    console.log(`🔍 Validating CSV for operation: ${operation}, course: ${courseId}`);
    console.log(`📁 File: ${req.file.originalname} (${req.file.size} bytes)`);
    console.log(`🗑️  Deletion mode: ${deletionMode || 'disabled'}`);

    const csvProcessor = new CsvProcessor();
    const result = await csvProcessor.parseAndValidate(
      req.file.buffer,
      operation,
      canvasUrl,
      apiToken,
      courseId
    );

    if (result.success) {
      // Generate preview based on operation type
      const preview = generateOperationPreview(result.data, operation);
      
      // Enhanced response with deletion warnings
      const response = {
        success: true,
        validation: result.validation,
        summary: result.summary,
        preview: preview,
        deletionMode: deletionMode || 'disabled',
        canExecute: result.validation.valid
      };

      // Add deletion-specific information
      if (result.validation.deletionWarnings && result.validation.deletionWarnings.length > 0) {
        response.deletionPreview = {
          missingSections: result.validation.deletionWarnings,
          totalSections: result.validation.deletionWarnings.length,
          totalStudentsAffected: result.validation.deletionWarnings.reduce((sum, s) => sum + s.studentCount, 0),
          deletionEnabled: deletionMode === 'enabled',
          warningLevel: 'high'
        };

        // Adjust can execute based on deletion mode
        if (deletionMode === 'enabled' && result.validation.deletionWarnings.length > 0) {
          response.requiresConfirmation = true;
          response.confirmationMessage = `You are about to delete ${result.validation.deletionWarnings.length} tool-created sections affecting ${response.deletionPreview.totalStudentsAffected} students. This action cannot be undone via CSV.`;
        }
      }

      // Set appropriate message
      let message = '';
      if (result.validation.valid) {
        if (result.validation.deletionWarnings && result.validation.deletionWarnings.length > 0) {
          if (deletionMode === 'enabled') {
            message = `CSV validation successful with deletion warnings: ${result.summary.validRows} valid rows, ${result.validation.deletionWarnings.length} sections will be deleted`;
          } else {
            message = `CSV validation successful with warnings: ${result.summary.validRows} valid rows, ${result.validation.deletionWarnings.length} sections missing (will be preserved)`;
          }
        } else {
          message = `CSV validation successful: ${result.summary.validRows} valid rows, ${result.summary.warningRows} warnings`;
        }
      } else {
        console.log(`❌ [DEBUG] CSV validation failed with errors:`, result.validation.errors);
        console.log(`❌ [DEBUG] Validation summary:`, result.summary);
        message = `CSV validation failed: ${result.summary.errorRows} errors found`;
      }

      response.message = message;
      res.json(response);
    } else {
      console.log(`❌ [DEBUG] CSV parsing failed:`, result.error);
      res.status(400).json({
        success: false,
        error: result.error,
        canExecute: false,
        deletionMode: deletionMode || 'disabled'
      });
    }

  } catch (error) {
    console.error('❌ CSV validation error:', error);
    res.status(500).json({
      error: 'CSV validation failed',
      message: error.message,
      canExecute: false,
      deletionMode: 'disabled'
    });
  }
});

// POST /api/csv/execute
// Execute validated CSV operations
router.post('/execute', upload.single('csvFile'), async (req, res) => {
  try {
    const { operation, courseId, canvasUrl, apiToken, userId, deletionMode, confirmDeletion } = req.body;

    if (!req.file) {
      return res.status(400).json({
        error: 'CSV file is required'
      });
    }

    if (!operation || !courseId || !canvasUrl || !apiToken) {
      return res.status(400).json({
        error: 'Operation type, course ID, Canvas URL, and API token are required'
      });
    }

    console.log(`🚀 Executing CSV operation: ${operation}, course: ${courseId}`);
    console.log(`🗑️  Deletion mode: ${deletionMode || 'disabled'}`);
    console.log(`✅ Deletion confirmed: ${confirmDeletion || false}`);

    const csvProcessor = new CsvProcessor();
    
    // Re-validate the CSV
    const validationResult = await csvProcessor.parseAndValidate(
      req.file.buffer,
      operation,
      canvasUrl,
      apiToken,
      courseId
    );

    if (!validationResult.success || !validationResult.validation.valid) {
      return res.status(400).json({
        error: 'CSV validation failed',
        validation: validationResult.validation,
        message: 'Please fix validation errors before execution'
      });
    }

    // Check deletion confirmation requirements
    const hasDeletions = validationResult.validation.deletionWarnings && 
                        validationResult.validation.deletionWarnings.length > 0;
    
    if (deletionMode === 'enabled' && hasDeletions && !confirmDeletion) {
      return res.status(400).json({
        error: 'Deletion confirmation required',
        message: 'You must confirm deletion of tool-created sections before proceeding',
        deletionPreview: {
          missingSections: validationResult.validation.deletionWarnings,
          totalSections: validationResult.validation.deletionWarnings.length,
          totalStudentsAffected: validationResult.validation.deletionWarnings.reduce((sum, s) => sum + s.studentCount, 0)
        },
        requiresConfirmation: true
      });
    }

    // Execute based on operation type
    const executionResult = await executeOperation(
      operation,
      validationResult.data,
      courseId,
      canvasUrl,
      apiToken,
      userId,
      req,
      {
        deletionMode: deletionMode || 'disabled',
        deletionConfirmed: confirmDeletion || false,
        missingSections: validationResult.validation.deletionWarnings || []
      }
    );

    res.json(executionResult);

  } catch (error) {
    console.error('❌ CSV execution error:', error);
    res.status(500).json({
      error: 'CSV execution failed',
      message: error.message
    });
  }
});

// GET /api/csv/session/:sessionId
// Get CSV operation session details
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { courseId, canvasUrl, apiToken } = req.query;
    
    if (!courseId || !canvasUrl || !apiToken) {
      return res.status(400).json({
        error: 'Course ID, Canvas URL, and API token are required as query parameters'
      });
    }

    // Reuse existing session endpoint from sections route
    const sessionResponse = await fetch(`${req.protocol}://${req.get('host')}/api/sections/session/${sessionId}?courseId=${courseId}&canvasUrl=${encodeURIComponent(canvasUrl)}&apiToken=${apiToken}`, {
      method: 'GET'
    });

    const sessionData = await sessionResponse.json();
    
    res.json({
      ...sessionData,
      operationType: 'csv_bulk_operation',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Session details fetch failed:', error);
    res.status(500).json({
      error: 'Failed to fetch session details',
      message: error.message
    });
  }
});

// POST /api/csv/session/:sessionId/rollback
// Rollback CSV operation session
router.post('/session/:sessionId/rollback', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { courseId, canvasUrl, apiToken, userId } = req.body;
    
    if (!courseId || !canvasUrl || !apiToken) {
      return res.status(400).json({
        error: 'Course ID, Canvas URL, and API token are required'
      });
    }

    console.log(`🔄 Rolling back CSV session ${sessionId}`);

    // Reuse existing rollback endpoint from sections route
    const rollbackResponse = await fetch(`${req.protocol}://${req.get('host')}/api/sections/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId,
        sessionId,
        canvasUrl,
        apiToken,
        userId
      })
    });

    const rollbackData = await rollbackResponse.json();
    
    res.json({
      ...rollbackData,
      operationType: 'csv_bulk_rollback',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ CSV rollback failed:', error);
    res.status(500).json({
      error: 'CSV rollback failed',
      message: error.message
    });
  }
});

// Helper function to generate operation preview
function generateOperationPreview(data, operation) {
  const preview = {
    operation,
    totalRows: data.length,
    preview: []
  };

  switch (operation) {
    case 'bulk-operations':
      const operations = {
        create_section: [],
        enroll_student: [],
        move_student: [],
        delete_section: []
      };

      data.forEach(row => {
        if (row.operation === 'create_and_enroll' && row.section_id.startsWith('NEW_')) {
          operations.create_section.push(row.name);
          if (row.student_name) {
            operations.enroll_student.push(`${row.student_name} → ${row.name}`);
          }
        } else if (row.operation === 'current_enrollment' && row.student_name) {
          operations.enroll_student.push(`${row.student_name} → ${row.name}`);
        } else if (row.status === 'deleted') {
          operations.delete_section.push(row.name);
        }
      });

      preview.sectionsToCreate = [...new Set(operations.create_section)].length;
      preview.studentsToEnroll = operations.enroll_student.length;
      preview.sectionsToDelete = [...new Set(operations.delete_section)].length;
      preview.preview = {
        newSections: [...new Set(operations.create_section)].slice(0, 5),
        enrollments: operations.enroll_student.slice(0, 5),
        deletions: [...new Set(operations.delete_section)].slice(0, 5)
      };
      break;
  }

  return preview;
}

// Helper function to execute operations
async function executeOperation(operation, data, courseId, canvasUrl, apiToken, userId, req, options) {
  const startTime = Date.now();

  switch (operation) {
    case 'bulk-operations':
      return await executeBulkOperations(data, courseId, canvasUrl, apiToken, userId, req, options);
    
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

// Execute bulk operations from unified CSV
async function executeBulkOperations(data, courseId, canvasUrl, apiToken, userId, req, options = {}) {
  const startTime = Date.now();
  console.log(`🔍 [DEBUG] Starting bulk operations with options:`, {
    deletionMode: options.deletionMode,
    deletionConfirmed: options.deletionConfirmed,
    missingSectionsCount: options.missingSections?.length || 0
  });
  
  const results = {
    sectionsCreated: 0,
    studentsEnrolled: 0,
    sectionsDeleted: 0,
    studentsRemoved: 0,
    errors: [],
    sessionId: null,
    deletionDetails: []
  };

  try {
    // Group operations by type
    const operations = {
      createSections: [],
      enrollments: [],
      deletions: [],
      statusDeletions: [] // Explicit deletions via status="deleted"
    };

    // Parse operations from CSV data
    data.forEach(row => {
      // Handle new section creation
      if (row.operation === 'create_and_enroll' && row.section_id.startsWith('NEW_')) {
        let section = operations.createSections.find(s => s.externalName === row.name);
        if (!section) {
          section = {
            externalName: row.name,
            internalName: row.name,
            facilitator: row.facilitator_email ? { email: row.facilitator_email } : null,
            students: [],
            maxStudents: 25
          };
          operations.createSections.push(section);
        }
        
        if (row.student_name && row.student_id) {
          section.students.push({
            id: row.student_id,
            name: row.student_name
          });
        }
      }
      
      // Handle explicit deletions via status="deleted"
      if (row.status === 'deleted' && row.section_type === 'tool_created') {
        operations.statusDeletions.push({
          sectionId: row.section_id,
          sectionName: row.name,
          reason: 'explicit_status_deletion'
        });
      }
    });

    // Handle missing section deletions (if deletion mode enabled)
    if (options.deletionMode === 'enabled' && options.deletionConfirmed && options.missingSections) {
      console.log(`🗑️  Processing ${options.missingSections.length} missing sections for deletion`);
      
      operations.deletions = options.missingSections.map(section => ({
        sectionId: section.id,
        sectionName: section.name,
        studentCount: section.studentCount,
        students: section.students,
        reason: 'omission_deletion'
      }));
    }

    // Step 1: Execute section creation if any new sections
    if (operations.createSections.length > 0) {
      console.log(`📝 Creating ${operations.createSections.length} new sections`);
      
      const sectionResponse = await fetch(`${req.protocol}://${req.get('host')}/api/sections/create-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          sections: operations.createSections,
          canvasUrl,
          apiToken,
          userId
        })
      });

      const sectionResults = await sectionResponse.json();
      
      if (sectionResults.success) {
        results.sectionsCreated = sectionResults.results?.successful?.length || 0;
        results.sessionId = sectionResults.sessionId;
        
        const totalStudents = operations.createSections.reduce((sum, s) => sum + s.students.length, 0);
        results.studentsEnrolled = totalStudents;
      } else {
        results.errors.push('Section creation failed');
      }
    }

    // Step 2: Execute deletions (both explicit and missing)
    const allDeletions = [...operations.deletions, ...operations.statusDeletions];
    
    if (allDeletions.length > 0) {
      console.log(`🗑️  Deleting ${allDeletions.length} sections`);
      console.log(`🔍 [DEBUG] Deletion details:`, allDeletions.map(d => ({ id: d.sectionId, name: d.sectionName, reason: d.reason })));
      
      const CanvasAPI = require('../services/canvasAPI');
      const canvasAPI = new CanvasAPI(canvasUrl, apiToken);
      
      for (const deletion of allDeletions) {
        try {
          console.log(`🗑️  [DEBUG] Processing deletion of section: ${deletion.sectionName} (ID: ${deletion.sectionId})`);
          
          // Get current enrollments before deletion
          const enrollments = await canvasAPI.getSectionEnrollments(deletion.sectionId);
          const studentEnrollments = enrollments.filter(e => e.type === 'StudentEnrollment' && e.enrollment_state === 'active');
          
          console.log(`📊 [DEBUG] Section has ${studentEnrollments.length} active student enrollments to remove`);
          studentEnrollments.forEach(enrollment => {
            console.log(`  - Student ${enrollment.user?.name || enrollment.user_id} (Enrollment ID: ${enrollment.id})`);
          });
          
          // Remove all students from the section
          for (const enrollment of studentEnrollments) {
            try {
              console.log(`👤 [DEBUG] Removing student ${enrollment.user?.name || enrollment.user_id} (enrollment ${enrollment.id})`);
              await canvasAPI.unenrollStudentFromSection(enrollment.id);
              results.studentsRemoved++;
              console.log(`  ✅ Successfully removed student`);
            } catch (error) {
              console.error(`  ❌ Failed to remove student ${enrollment.user_id} from section ${deletion.sectionId}: ${error.message}`);
              results.errors.push(`Failed to remove student from ${deletion.sectionName}: ${error.message}`);
            }
          }
          
          // Delete the section
          console.log(`🗑️  [DEBUG] Deleting section ${deletion.sectionName}`);
          await canvasAPI.deleteSection(deletion.sectionId);
          results.sectionsDeleted++;
          
          results.deletionDetails.push({
            sectionId: deletion.sectionId,
            sectionName: deletion.sectionName,
            studentsRemoved: studentEnrollments.length,
            reason: deletion.reason,
            status: 'success'
          });
          
          console.log(`✅ [DEBUG] Successfully deleted section ${deletion.sectionName} and removed ${studentEnrollments.length} students`);
          
        } catch (error) {
          console.error(`❌ [DEBUG] Failed to delete section ${deletion.sectionName}: ${error.message}`);
          results.errors.push(`Failed to delete section ${deletion.sectionName}: ${error.message}`);
          
          results.deletionDetails.push({
            sectionId: deletion.sectionId,
            sectionName: deletion.sectionName,
            studentsRemoved: 0,
            reason: deletion.reason,
            status: 'failed',
            error: error.message
          });
        }
      }
    } else {
      console.log(`🔍 [DEBUG] No deletions to process. operations.deletions: ${operations.deletions.length}, operations.statusDeletions: ${operations.statusDeletions.length}`);
    }

    // Generate comprehensive result message
    let message = 'Bulk operation completed. ';
    const messageParts = [];
    
    if (results.sectionsCreated > 0) {
      messageParts.push(`Created ${results.sectionsCreated} sections`);
    }
    if (results.sectionsDeleted > 0) {
      messageParts.push(`Deleted ${results.sectionsDeleted} sections`);
    }
    if (results.studentsEnrolled > 0) {
      messageParts.push(`Enrolled ${results.studentsEnrolled} students`);
    }
    if (results.studentsRemoved > 0) {
      messageParts.push(`Removed ${results.studentsRemoved} students`);
    }
    if (results.errors.length > 0) {
      messageParts.push(`${results.errors.length} errors occurred`);
    }
    
    message += messageParts.join(', ');

    return {
      success: results.errors.length === 0,
      operation: 'bulk-operations',
      results,
      executionTime: Date.now() - startTime,
      message,
      deletionMode: options.deletionMode || 'disabled'
    };

  } catch (error) {
    return {
      success: false,
      operation: 'bulk-operations',
      error: error.message,
      results,
      deletionMode: options.deletionMode || 'disabled'
    };
  }
}

module.exports = router; 