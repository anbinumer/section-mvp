const axios = require('axios');

class CanvasAPI {
  constructor(baseURL, apiToken) {
    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
    this.apiToken = apiToken;
    this.apiCallCount = 0;
    
    // Create axios instance with default config
    this.client = axios.create({
      baseURL: `${this.baseURL}/api/v1`,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        this.apiCallCount++;
        console.log(`🔗 Canvas API Call #${this.apiCallCount}: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ Canvas API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ Canvas API Success: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('❌ Canvas API Error:', error.response?.status, error.response?.data);
        return Promise.reject(this.formatError(error));
      }
    );
  }

  formatError(error) {
    if (error.response) {
      return {
        status: error.response.status,
        message: error.response.data?.message || error.response.statusText,
        errors: error.response.data?.errors || [],
        canvasError: true
      };
    } else if (error.request) {
      return {
        status: 0,
        message: 'Network error - unable to reach Canvas',
        canvasError: true
      };
    } else {
      return {
        status: 0,
        message: error.message,
        canvasError: true
      };
    }
  }

  // Authentication and user validation
  async getCurrentUser() {
    try {
      const response = await this.client.get('/users/self');
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async validateEditingLecturer(courseId) {
    try {
      const response = await this.client.get(`/courses/${courseId}/enrollments`, {
        params: {
          user_id: 'self',
          state: ['active'],
          type: ['TeacherEnrollment']
        }
      });
      
      const enrollment = response.data.find(enroll => 
        enroll.role === 'Editing Lecturer' || enroll.role === 'TeacherEnrollment'
      );
      
      return !!enrollment;
    } catch (error) {
      throw error;
    }
  }

  // Course data fetching
  async getCourse(courseId) {
    try {
      const response = await this.client.get(`/courses/${courseId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getCourseUsers(courseId, role = null) {
    try {
      const params = {
        per_page: 100,
        include: ['enrollments']
      };
      
      if (role) {
        params.enrollment_type = [role];
      }

      let allUsers = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.client.get(`/courses/${courseId}/users`, {
          params: { ...params, page }
        });

        allUsers = allUsers.concat(response.data);
        
        // Check if there are more pages
        const linkHeader = response.headers.link;
        hasMore = linkHeader && linkHeader.includes('rel="next"');
        page++;
      }

      return allUsers;
    } catch (error) {
      throw error;
    }
  }

  async getStudents(courseId) {
    return this.getCourseUsers(courseId, 'StudentEnrollment');
  }

  async getFacilitators(courseId) {
    const teachers = await this.getCourseUsers(courseId, 'TeacherEnrollment');
    // Filter out Editing Lecturers, keep only Teachers (Online Facilitators)
    return teachers.filter(user => {
      const enrollment = user.enrollments?.find(e => e.course_id == courseId);
      return enrollment && enrollment.role !== 'Editing Lecturer';
    });
  }

  // Section management
  async getSections(courseId) {
    try {
      const response = await this.client.get(`/courses/${courseId}/sections`, {
        params: {
          include: ['students', 'total_students']
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get sections created by our tool (using SIS section ID prefix)
   */
  async getToolCreatedSections(courseId) {
    try {
      const allSections = await this.getSections(courseId);
      return allSections.filter(section => 
        this.isToolCreatedSection(section)
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get sections NOT created by our tool (default, manual, other tools)
   */
  async getNonToolSections(courseId) {
    try {
      const allSections = await this.getSections(courseId);
      return allSections.filter(section => 
        !this.isToolCreatedSection(section)
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if a section was created by our tool
   */
  isToolCreatedSection(section) {
    // Check SIS section ID prefix
    if (section.sis_section_id && section.sis_section_id.startsWith('ACU_SM_')) {
      return true;
    }
    
    // Check integration ID for tool metadata
    if (section.integration_id) {
      try {
        const metadata = JSON.parse(section.integration_id);
        if (metadata.tool === 'ACU_Section_Manager') {
          return true;
        }
      } catch (e) {
        // Invalid JSON, not our section
      }
    }
    
    return false;
  }

  /**
   * Generate SIS section ID for our tool
   */
  generateToolSectionId(sectionNumber, userId) {
    const timestamp = Date.now();
    const sessionId = Math.random().toString(36).substr(2, 9);
    return `ACU_SM_${timestamp}_${sectionNumber}_${sessionId}`;
  }

  /**
   * Generate integration ID with metadata
   */
  generateIntegrationId(userId, sessionId) {
    return JSON.stringify({
      tool: 'ACU_Section_Manager',
      version: '1.0',
      createdBy: userId,
      timestamp: new Date().toISOString(),
      sessionId: sessionId
    });
  }

  /**
   * Get sections by session ID (Canvas-only approach)
   */
  async getSectionsBySession(courseId, sessionId) {
    try {
      const allSections = await this.getSections(courseId);
      return allSections.filter(section => {
        if (section.integration_id) {
          try {
            const metadata = JSON.parse(section.integration_id);
            return metadata.sessionId === sessionId;
          } catch (e) {
            return false;
          }
        }
        return false;
      });
    } catch (error) {
      throw error;
    }
  }

  async createSection(courseId, sectionData) {
    try {
      const response = await this.client.post(`/courses/${courseId}/sections`, {
        course_section: {
          name: sectionData.name,
          sis_section_id: sectionData.sis_section_id || null,
          integration_id: sectionData.integration_id || null,
          start_at: sectionData.start_at || null,
          end_at: sectionData.end_at || null
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async deleteSection(sectionId) {
    try {
      const response = await this.client.delete(`/sections/${sectionId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Student enrollment management
  // Note: Canvas allows students to be in multiple sections of the same course
  // This adds them to new sections without removing from existing ones
  async enrollStudentInSection(sectionId, userId) {
    try {
      const response = await this.client.post(`/sections/${sectionId}/enrollments`, {
        enrollment: {
          user_id: userId,
          type: 'StudentEnrollment',
          enrollment_state: 'active'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Facilitator enrollment management
  // Assign a user as Teacher (Online Facilitator) in the course
  async assignUserAsTeacher(courseId, userId, sectionId = null) {
    try {
      const enrollmentData = {
        enrollment: {
          user_id: userId,
          type: 'TeacherEnrollment',
          enrollment_state: 'active'
        }
      };

      let endpoint;
      if (sectionId) {
        // Assign to specific section
        endpoint = `/sections/${sectionId}/enrollments`;
      } else {
        // Assign to entire course
        endpoint = `/courses/${courseId}/enrollments`;
      }

      console.log(`🔗 Assigning user ${userId} as Teacher in course ${courseId}`, 
                  sectionId ? `(section ${sectionId})` : '(course-wide)');
      console.log(`📤 Enrollment data:`, JSON.stringify(enrollmentData, null, 2));

      const response = await this.client.post(endpoint, enrollmentData);
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to assign Teacher role:`, {
        endpoint,
        enrollmentData,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  async unenrollStudentFromSection(enrollmentId) {
    try {
      const response = await this.client.delete(`/enrollments/${enrollmentId}`, {
        data: {
          task: 'delete'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Bulk operations with retry logic
  async bulkEnrollStudents(enrollments, progressCallback = null) {
    const results = {
      successful: [],
      failed: [],
      total: enrollments.length
    };

    console.log(`🔄 Starting bulk enrollment of ${enrollments.length} students`);

    for (let i = 0; i < enrollments.length; i++) {
      const { sectionId, userId, studentName } = enrollments[i];
      
      try {
        // Add small delay to avoid rate limiting
        if (i > 0 && i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const result = await this.enrollStudentInSection(sectionId, userId);
        results.successful.push({ sectionId, userId, studentName, enrollment: result });
        
        if (progressCallback) {
          progressCallback(i + 1, enrollments.length, 'success', studentName);
        }
      } catch (error) {
        console.error(`❌ Failed to enroll ${studentName} (${userId}) in section ${sectionId}:`, error.message);
        results.failed.push({ sectionId, userId, studentName, error: error.message });
        
        if (progressCallback) {
          progressCallback(i + 1, enrollments.length, 'error', studentName, error.message);
        }
      }
    }

    console.log(`✅ Bulk enrollment complete: ${results.successful.length} successful, ${results.failed.length} failed`);
    return results;
  }

  // Utility methods
  getApiCallCount() {
    return this.apiCallCount;
  }

  resetApiCallCount() {
    this.apiCallCount = 0;
  }

  /**
   * Get multiple sections by their IDs (fetch all sections for the course and filter)
   * @param {Array} sectionIds
   * @returns {Array}
   */
  async getSectionsByIds(sectionIds) {
    // This method assumes you have access to the courseId in context or as a property
    // If not, you may need to pass courseId as an argument
    // For now, fetch all sections for all possible courseIds (since section IDs are unique in Canvas)
    // We'll fetch each section individually
    const results = [];
    for (const id of sectionIds) {
      try {
        const response = await this.client.get(`/sections/${id}`);
        results.push(response.data);
      } catch (e) {
        // Ignore not found
      }
    }
    return results;
  }
}

module.exports = CanvasAPI;