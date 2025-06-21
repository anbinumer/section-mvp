const express = require('express');
const router = express.Router();
const AllocationService = require('../services/allocationService');
const AllocationLog = require('../models/AllocationLog');

// POST /api/allocations/analyze
// Analyze course data and generate recommendations
router.post('/analyze', async (req, res) => {
  try {
    const { students, facilitators, sections } = req.body;
    
    if (!students || !facilitators) {
      return res.status(400).json({
        error: 'Students and facilitators data are required'
      });
    }

    const allocationService = new AllocationService();
    const analysis = allocationService.analyzeCourse(students, facilitators, sections || []);
    
    res.json({
      success: true,
      analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Analysis error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message
    });
  }
});

// POST /api/allocations/generate-plan
// Generate detailed allocation plan
router.post('/generate-plan', async (req, res) => {
  try {
    const { students, facilitators, sectionConfig, strategy = 'balanced' } = req.body;
    
    if (!students || !facilitators || !sectionConfig) {
      return res.status(400).json({
        error: 'Students, facilitators, and section configuration are required'
      });
    }

    const allocationService = new AllocationService();
    
    // Generate allocation plan
    const plan = allocationService.createAllocationPlan(
      students, 
      facilitators, 
      sectionConfig, 
      strategy
    );
    
    // Validate the plan
    const validation = allocationService.validateAllocationPlan(plan);
    
    res.json({
      success: true,
      plan,
      validation,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Plan generation error:', error);
    res.status(500).json({
      error: 'Plan generation failed',
      message: error.message
    });
  }
});

// POST /api/allocations/execute
// Execute the full allocation process
router.post('/execute', async (req, res) => {
  try {
    const { 
      courseId, 
      plan, 
      canvasUrl, 
      apiToken, 
      userId, 
      userName 
    } = req.body;
    
    if (!courseId || !plan || !canvasUrl || !apiToken) {
      return res.status(400).json({
        error: 'Course ID, allocation plan, Canvas URL, and API token are required'
      });
    }

    console.log(`🚀 Starting allocation execution for course ${courseId}`);

    // Create allocation log
    const allocationLog = new AllocationLog({
      canvasCourseId: courseId,
      userId: userId || 'unknown',
      userName: userName || 'Unknown User',
      operation: 'allocate_students',
      beforeState: {
        studentCount: plan.totalStudents || plan.sections?.reduce((sum, section) => sum + section.students.length, 0) || 0,
        facilitatorCount: plan.summary?.facilitatorsAssigned || plan.sections?.filter(s => s.facilitator).length || 0,
        existingSections: []
      },
      parameters: {
        targetRatio: 25,
        maxRatio: 50,
        allocationStrategy: plan.strategy
      },
      status: 'failed' // Will be updated on success
    });

    const startTime = Date.now();

    try {
      // Debug: Log the plan structure
      console.log('🔍 Plan structure:', JSON.stringify(plan, null, 2));
      
      // Step 0: Assign Editing Lecturer as Teacher if requested
      if (plan.config && plan.config.assignEditingLecturer) {
        console.log('👩‍🏫 Assigning Editing Lecturer as Teacher...');
        const CanvasAPI = require('../services/canvasAPI');
        const canvasAPI = new CanvasAPI(canvasUrl, apiToken);
        
        try {
          // Get the current user (Editing Lecturer) from Canvas API
          const currentUser = await canvasAPI.getCurrentUser();
          console.log(`🔍 Current user from Canvas: ${currentUser.name} (${currentUser.id})`);
          
          await canvasAPI.assignUserAsTeacher(courseId, currentUser.id);
          console.log('✅ Editing Lecturer assigned as Teacher');
          allocationLog.apiCalls.total += canvasAPI.getApiCallCount();
        } catch (error) {
          console.log(`⚠️ Could not assign Editing Lecturer as Teacher: ${error.message}`);
          // Don't fail the entire operation if this fails
        }
      } else {
        console.log('🔍 Editing Lecturer assignment not requested or config missing');
        console.log('🔍 plan.config:', plan.config);
        console.log('🔍 plan.config.assignEditingLecturer:', plan.config?.assignEditingLecturer);
      }

      // Step 1: Create sections
      console.log('📝 Creating sections...');
      const sectionResponse = await fetch(`${req.protocol}://${req.get('host')}/api/sections/create-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          sections: plan.sections,
          canvasUrl,
          apiToken,
          userId
        })
      });

      const sectionResults = await sectionResponse.json();
      
      if (!sectionResults.success || sectionResults.results.failed.length > 0) {
        throw new Error(`Section creation failed: ${sectionResults.results.failed.length} sections failed`);
      }

      allocationLog.apiCalls.total += sectionResults.apiCalls || 0;

      // Step 2: Prepare student enrollments
      console.log('👥 Preparing student enrollments...');
      const enrollments = [];
      
      sectionResults.results.successful.forEach((result, sectionIndex) => {
        const sectionStudents = plan.sections[sectionIndex].students;
        const canvasSectionId = result.canvasSection.id;
        
        sectionStudents.forEach(student => {
          enrollments.push({
            sectionId: canvasSectionId,
            userId: student.id,
            studentName: student.name
          });
        });
      });

      // Step 3: Enroll students (this adds them to new sections, doesn't remove from existing ones)
      console.log(`📚 Enrolling ${enrollments.length} students in new sections (preserving existing enrollments)...`);
      
      // Initialize Canvas API
      const CanvasAPI = require('../services/canvasAPI');
      const canvasAPI = new CanvasAPI(canvasUrl, apiToken);
      
      // Actually enroll students in Canvas sections
      const enrollmentResults = await canvasAPI.bulkEnrollStudents(enrollments, (current, total, status, studentName, error) => {
        if (status === 'success') {
          console.log(`✅ Enrolled ${studentName} (${current}/${total})`);
        } else {
          console.log(`❌ Failed to enroll ${studentName}: ${error} (${current}/${total})`);
        }
      });
      
      allocationLog.apiCalls.total += canvasAPI.getApiCallCount();

      // Update allocation log
      allocationLog.afterState = {
        studentCount: plan.totalStudents || plan.sections?.reduce((sum, section) => sum + section.students.length, 0) || 0,
        facilitatorCount: plan.summary?.facilitatorsAssigned || plan.sections?.filter(s => s.facilitator).length || 0,
        sectionsCreated: plan.sections.map(s => s.externalName),
        studentsAllocated: enrollmentResults.successful.length
      };

      allocationLog.executionTime = Date.now() - startTime;
      allocationLog.apiCalls.successful = allocationLog.apiCalls.total;
      allocationLog.status = 'success';

      await allocationLog.save();

      console.log('✅ Allocation completed successfully');

      res.json({
        success: true,
        message: 'Allocation completed successfully',
        results: {
          sectionsCreated: sectionResults.results.successful.length,
          studentsEnrolled: enrollmentResults.successful.length,
          totalApiCalls: allocationLog.apiCalls.total,
          executionTime: allocationLog.executionTime
        },
        logId: allocationLog._id
      });

    } catch (executionError) {
      // Log the error
      await allocationLog.addError('execution', executionError.message);
      allocationLog.executionTime = Date.now() - startTime;
      await allocationLog.markAsFailed(executionError.message);
      
      throw executionError;
    }

  } catch (error) {
    console.error('❌ Allocation execution error:', error);
    res.status(500).json({
      error: 'Allocation execution failed',
      message: error.message
    });
  }
});

// GET /api/allocations/history/:courseId
// Get allocation history for a course
router.get('/history/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    
    const logs = await AllocationLog.findByCourse(courseId).limit(limit);
    
    res.json({
      success: true,
      history: logs.map(log => ({
        id: log._id,
        operation: log.operation,
        userName: log.userName,
        status: log.status,
        sectionsCreated: log.afterState?.sectionsCreated?.length || 0,
        studentsAllocated: log.afterState?.studentsAllocated || 0,
        executionTime: log.executionTime,
        createdAt: log.createdAt,
        errors: log.errors
      }))
    });

  } catch (error) {
    console.error('❌ Failed to fetch allocation history:', error);
    res.status(500).json({
      error: 'Failed to fetch allocation history',
      message: error.message
    });
  }
});

// GET /api/allocations/log/:logId
// Get detailed allocation log
router.get('/log/:logId', async (req, res) => {
  try {
    const { logId } = req.params;
    
    const log = await AllocationLog.findById(logId);
    
    if (!log) {
      return res.status(404).json({
        error: 'Allocation log not found'
      });
    }
    
    res.json({
      success: true,
      log: {
        id: log._id,
        courseId: log.canvasCourseId,
        operation: log.operation,
        user: {
          id: log.userId,
          name: log.userName
        },
        beforeState: log.beforeState,
        afterState: log.afterState,
        parameters: log.parameters,
        status: log.status,
        errors: log.errors,
        executionTime: log.executionTime,
        apiCalls: log.apiCalls,
        createdAt: log.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Failed to fetch allocation log:', error);
    res.status(500).json({
      error: 'Failed to fetch allocation log',
      message: error.message
    });
  }
});

// GET /api/allocations/health
// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Allocation Management',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router; 