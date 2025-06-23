const express = require('express');
const router = express.Router();
const CanvasAPI = require('../services/canvasAPI');

// POST /api/sections/create-bulk
router.post('/create-bulk', async (req, res) => {
  try {
    const { courseId, sections, canvasUrl, apiToken, userId } = req.body;
    
    if (!courseId || !sections || !Array.isArray(sections)) {
      return res.status(400).json({
        error: 'Course ID and sections array are required'
      });
    }

    const canvasAPI = new CanvasAPI(canvasUrl, apiToken);
    console.log(`📝 Creating ${sections.length} sections for course ${courseId}`);

    // Generate session ID for this allocation batch
    const sessionId = Math.random().toString(36).substr(2, 9);
    console.log(`🆔 Allocation session ID: ${sessionId}`);

    const results = {
      successful: [],
      failed: [],
      total: sections.length,
      sessionId: sessionId
    };

    // Create sections one by one
    for (let i = 0; i < sections.length; i++) {
      const sectionData = sections[i];
      const sectionNumber = i + 1;
      
      try {
        // Generate tool-specific identifiers
        const sisSectionId = canvasAPI.generateToolSectionId(sectionNumber, userId);
        const integrationId = canvasAPI.generateIntegrationId(userId, sessionId);
        
        console.log(`📝 Creating section ${sectionNumber}: ${sectionData.externalName} (SIS: ${sisSectionId})`);

        const canvasSection = await canvasAPI.createSection(courseId, {
          name: sectionData.externalName,
          sis_section_id: sisSectionId,
          integration_id: integrationId
        });

        results.successful.push({ 
          sectionData, 
          canvasSection,
          toolIdentifiers: {
            sisSectionId,
            integrationId,
            sessionId
          }
        });

      } catch (error) {
        console.error(`❌ Failed to create section ${sectionNumber}:`, error);
        results.failed.push({ 
          sectionData, 
          error: error.message,
          sectionNumber 
        });
      }
    }

    res.json({
      success: true,
      message: `Created ${results.successful.length} of ${results.total} sections`,
      results,
      apiCalls: canvasAPI.getApiCallCount()
    });

  } catch (error) {
    console.error('❌ Section creation failed:', error);
    res.status(500).json({
      error: 'Section creation failed',
      message: error.message
    });
  }
});

// POST /api/sections/rollback
// Safely rollback sections created by our tool in a specific session
router.post('/rollback', async (req, res) => {
  try {
    const { courseId, sessionId, canvasUrl, apiToken, userId } = req.body;
    
    if (!courseId || !sessionId || !canvasUrl || !apiToken) {
      return res.status(400).json({
        error: 'Course ID, session ID, Canvas URL, and API token are required'
      });
    }

    console.log(`🔄 Rolling back sections for session ${sessionId} in course ${courseId}`);

    const canvasAPI = new CanvasAPI(canvasUrl, apiToken);

    // Find sections created in this session using Canvas API
    const sessionSections = await canvasAPI.getSectionsBySession(courseId, sessionId);
    
    if (sessionSections.length === 0) {
      return res.json({
        success: true,
        message: 'No sections found for this session',
        results: {
          deleted: 0,
          failed: 0,
          total: 0
        }
      });
    }

    console.log(`📋 Found ${sessionSections.length} sections to rollback`);

    const results = {
      deleted: [],
      failed: [],
      total: sessionSections.length
    };

    // Delete sections one by one
    for (const section of sessionSections) {
      try {
        console.log(`🗑️ Deleting section: ${section.name} (${section.id})`);
        
        // Delete from Canvas
        await canvasAPI.deleteSection(section.id);
        
        results.deleted.push({
          sectionId: section.id,
          name: section.name
        });
        
        console.log(`✅ Successfully deleted section: ${section.name}`);
        
      } catch (error) {
        console.error(`❌ Failed to delete section ${section.name}:`, error);
        results.failed.push({
          sectionId: section.id,
          name: section.name,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Rollback completed: ${results.deleted.length} sections deleted, ${results.failed.length} failed`,
      results,
      apiCalls: canvasAPI.getApiCallCount()
    });

  } catch (error) {
    console.error('❌ Rollback failed:', error);
    res.status(500).json({
      error: 'Rollback failed',
      message: error.message
    });
  }
});

// GET /api/sections/session/:sessionId
// Get details about sections created in a specific session
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { courseId, canvasUrl, apiToken } = req.query;
    
    if (!courseId || !canvasUrl || !apiToken) {
      return res.status(400).json({
        error: 'Course ID, Canvas URL, and API token are required as query parameters'
      });
    }

    const canvasAPI = new CanvasAPI(canvasUrl, apiToken);
    const sections = await canvasAPI.getSectionsBySession(courseId, sessionId);
    
    res.json({
      success: true,
      sessionId,
      sections: sections.map(s => ({
        id: s.id,
        name: s.name,
        total_students: s.total_students || 0,
        sis_section_id: s.sis_section_id,
        created_at: s.created_at
      })),
      summary: {
        total: sections.length,
        totalStudents: sections.reduce((sum, s) => sum + (s.total_students || 0), 0)
      }
    });

  } catch (error) {
    console.error('❌ Session details fetch failed:', error);
    res.status(500).json({
      error: 'Failed to fetch session details',
      message: error.message
    });
  }
});

// GET /api/sections/health
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Sections Management (Canvas-Only)',
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 