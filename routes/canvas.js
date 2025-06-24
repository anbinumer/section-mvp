const express = require('express');
const router = express.Router();
const CanvasAPI = require('../services/canvasAPI');
const AllocationService = require('../services/allocationService');

// Middleware to create Canvas API instance
const createCanvasInstance = (req, res, next) => {
  const { canvasUrl, apiToken } = req.body;
  
  if (!canvasUrl || !apiToken) {
    return res.status(400).json({
      error: 'Canvas URL and API token are required'
    });
  }

  try {
    req.canvasAPI = new CanvasAPI(canvasUrl, apiToken);
    next();
  } catch (error) {
    res.status(400).json({
      error: 'Invalid Canvas URL or API token format',
      details: error.message
    });
  }
};

// POST /api/canvas/validate
// Validate Canvas credentials and user permissions
router.post('/validate', createCanvasInstance, async (req, res) => {
  try {
    const { courseId } = req.body;
    
    if (!courseId) {
      return res.status(400).json({
        error: 'Course ID is required'
      });
    }

    // Get current user info
    const user = await req.canvasAPI.getCurrentUser();
    console.log(`👤 User authenticated: ${user.name} (${user.id})`);

    // Validate user has Editing Lecturer permissions
    const isEditingLecturer = await req.canvasAPI.validateEditingLecturer(courseId);
    
    if (!isEditingLecturer) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You must be an Editing Lecturer to use this tool',
        userRole: 'Insufficient permissions'
      });
    }

    // Get course information
    const course = await req.canvasAPI.getCourse(courseId);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.primary_email
      },
      course: {
        id: course.id,
        name: course.name,
        course_code: course.course_code,
        enrollment_term_id: course.enrollment_term_id
      },
      permissions: {
        isEditingLecturer: true,
        canManageSections: true,
        canEnrollStudents: true
      }
    });

  } catch (error) {
    console.error('❌ Canvas validation error:', error);
    
    if (error.canvasError) {
      res.status(error.status || 400).json({
        error: 'Canvas API Error',
        message: error.message,
        canvasError: true
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'production' ? 'Validation failed' : error.message
      });
    }
  }
});

// POST /api/canvas/course-data
// Fetch comprehensive course data for analysis
router.post('/course-data', createCanvasInstance, async (req, res) => {
  try {
    const { courseId } = req.body;
    
    if (!courseId) {
      return res.status(400).json({
        error: 'Course ID is required'
      });
    }

    console.log(`📊 Fetching course data for course ${courseId}`);

    // Fetch all course data in parallel
    const [course, students, facilitators, sections] = await Promise.all([
      req.canvasAPI.getCourse(courseId),
      req.canvasAPI.getStudents(courseId),
      req.canvasAPI.getFacilitators(courseId),
      req.canvasAPI.getSections(courseId)
    ]);

    // For each section, fetch students (enrollments of type StudentEnrollment)
    for (const section of sections) {
      try {
        const enrollments = await req.canvasAPI.getSectionEnrollments(section.id);
        section.students = enrollments
          .filter(e => e.type === 'StudentEnrollment')
          .map(e => ({ id: e.user_id, name: e.user?.name || e.sis_user_id || e.user_id }));
        console.log(`[Section] ${section.id} - ${section.name}: ${enrollments.length} enrollments, ${section.students.length} students`);
      } catch (e) {
        section.students = [];
        console.log(`[Section] ${section.id} - ${section.name}: failed to fetch enrollments (${e.message})`);
      }
    }

    console.log(`📈 Course data summary:
      - Students: ${students.length}
      - Facilitators: ${facilitators.length}
      - Sections: ${sections.length}`);

    // Analyze course data using allocation service
    const allocationService = new AllocationService();
    const analysis = allocationService.analyzeCourse(students, facilitators, sections);

    res.json({
      success: true,
      course: {
        id: course.id,
        name: course.name,
        course_code: course.course_code
      },
      data: {
        students: students.map(s => ({
          id: s.id,
          name: s.name,
          sortable_name: s.sortable_name,
          email: s.email,
          sis_user_id: s.sis_user_id
        })),
        facilitators: facilitators.map(f => ({
          id: f.id,
          name: f.name,
          email: f.email,
          enrollments: f.enrollments?.filter(e => e.course_id == courseId)
        })),
        sections: sections.map(s => ({
          id: s.id,
          name: s.name,
          course_id: s.course_id,
          total_students: s.total_students || 0,
          sis_section_id: s.sis_section_id,
          integration_id: s.integration_id,
          isToolCreated: req.canvasAPI.isToolCreatedSection(s),
          students: s.students || []
        }))
      },
      analysis,
      apiCalls: req.canvasAPI.getApiCallCount()
    });

  } catch (error) {
    console.error('❌ Course data fetch error:', error);
    
    if (error.canvasError) {
      res.status(error.status || 400).json({
        error: 'Canvas API Error',
        message: error.message,
        canvasError: true
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'production' ? 'Failed to fetch course data' : error.message
      });
    }
  }
});

// POST /api/canvas/analyze-sections
// Analyze existing sections to identify tool-created vs other sections
router.post('/analyze-sections', createCanvasInstance, async (req, res) => {
  try {
    const { courseId } = req.body;
    
    if (!courseId) {
      return res.status(400).json({
        error: 'Course ID is required'
      });
    }

    console.log(`🔍 Analyzing sections for course ${courseId}`);

    // Fetch all sections
    const allSections = await req.canvasAPI.getSections(courseId);
    
    // Categorize sections
    const toolSections = allSections.filter(s => req.canvasAPI.isToolCreatedSection(s));
    const nonToolSections = allSections.filter(s => !req.canvasAPI.isToolCreatedSection(s));
    
    // Analyze potential conflicts
    const analysis = {
      total: allSections.length,
      toolCreated: {
        count: toolSections.length,
        sections: toolSections.map(s => ({
          id: s.id,
          name: s.name,
          total_students: s.total_students || 0,
          sis_section_id: s.sis_section_id,
          createdBy: s.integration_id ? JSON.parse(s.integration_id).createdBy : 'unknown'
        }))
      },
      otherSections: {
        count: nonToolSections.length,
        sections: nonToolSections.map(s => ({
          id: s.id,
          name: s.name,
          total_students: s.total_students || 0,
          sis_section_id: s.sis_section_id,
          type: categorizeSection(s)
        }))
      },
      warnings: [],
      recommendations: []
    };

    // Generate warnings and recommendations
    if (toolSections.length > 0) {
      analysis.warnings.push({
        type: 'existing_tool_sections',
        message: `${toolSections.length} sections were previously created by this tool`,
        severity: 'warning',
        action: 'Consider reviewing existing allocations before creating new sections'
      });
    }

    if (nonToolSections.length > 0) {
      analysis.warnings.push({
        type: 'other_sections_exist',
        message: `${nonToolSections.length} sections exist that were not created by this tool`,
        severity: 'info',
        action: 'These sections will be preserved and not modified'
      });
    }

    // Check for potential naming conflicts
    const toolSectionNames = toolSections.map(s => s.name.toLowerCase());
    const nonToolSectionNames = nonToolSections.map(s => s.name.toLowerCase());
    
    analysis.recommendations.push({
      type: 'safe_operation',
      message: 'Tool will only modify sections it created, preserving all other sections',
      action: 'Proceed with confidence'
    });

    res.json({
      success: true,
      analysis,
      apiCalls: req.canvasAPI.getApiCallCount()
    });

  } catch (error) {
    console.error('❌ Section analysis error:', error);
    
    if (error.canvasError) {
      res.status(error.status || 400).json({
        error: 'Canvas API Error',
        message: error.message,
        canvasError: true
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'production' ? 'Failed to analyze sections' : error.message
      });
    }
  }
});

// Helper function to categorize non-tool sections
function categorizeSection(section) {
  if (section.name.toLowerCase().includes('default')) {
    return 'default';
  }
  if (section.sis_section_id && section.sis_section_id.startsWith('SIS_')) {
    return 'sis_imported';
  }
  if (section.integration_id) {
    try {
      const metadata = JSON.parse(section.integration_id);
      if (metadata.tool) {
        return `other_tool_${metadata.tool}`;
      }
    } catch (e) {
      // Invalid JSON
    }
  }
  return 'manual';
}

// POST /api/canvas/test-connection
// Simple endpoint to test Canvas connectivity
router.post('/test-connection', createCanvasInstance, async (req, res) => {
  try {
    const user = await req.canvasAPI.getCurrentUser();
    
    res.json({
      success: true,
      message: 'Canvas connection successful',
      user: {
        name: user.name,
        id: user.id
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Canvas connection test failed:', error);
    
    if (error.canvasError) {
      res.status(error.status || 400).json({
        error: 'Canvas connection failed',
        message: error.message,
        canvasError: true
      });
    } else {
      res.status(500).json({
        error: 'Connection test failed',
        message: error.message
      });
    }
  }
});

// GET /api/canvas/health
// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Canvas Integration',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router; 