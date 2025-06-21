const express = require('express');
const router = express.Router();
const CanvasAPI = require('../services/canvasAPI');
const Section = require('../models/Section');

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

    const results = {
      successful: [],
      failed: [],
      total: sections.length
    };

    // Create sections one by one
    for (const sectionData of sections) {
      try {
        const canvasSection = await canvasAPI.createSection(courseId, {
          name: sectionData.externalName
        });

        const dbSection = new Section({
          canvasCourseId: courseId,
          canvasSectionId: canvasSection.id.toString(),
          internalName: sectionData.internalName,
          externalName: sectionData.externalName,
          facilitatorId: sectionData.facilitator?.id || null,
          facilitatorName: sectionData.facilitator?.name || null,
          maxStudents: sectionData.maxStudents || 25,
          createdBy: userId || 'unknown',
          status: 'created'
        });

        await dbSection.save();
        results.successful.push({ sectionData, canvasSection, dbSection });

      } catch (error) {
        results.failed.push({ sectionData, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Created ${results.successful.length} of ${results.total} sections`,
      results,
      apiCalls: canvasAPI.getApiCallCount()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Section creation failed',
      message: error.message
    });
  }
});

// GET /api/sections/health
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Sections Management',
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 