class AllocationService {
  constructor() {
    this.defaultTargetRatio = 25;
    this.maxRatio = 50;
    this.strategies = ['random', 'alphabetical', 'balanced'];
  }

  /**
   * Analyze course data and generate allocation recommendations
   */
  analyzeCourse(students, facilitators, existingSections = []) {
    const analysis = {
      students: {
        total: students.length,
        unassigned: this.getUnassignedStudents(students, existingSections),
        inSections: students.length - this.getUnassignedStudents(students, existingSections).length
      },
      facilitators: {
        total: facilitators.length,
        available: facilitators.filter(f => !this.hasSectionAssignment(f, existingSections)).length
      },
      sections: {
        existing: existingSections.length,
        nonDefault: existingSections.filter(s => !s.name.toLowerCase().includes('default')).length
      },
      recommendations: null,
      warnings: []
    };

    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(analysis);
    
    // Add warnings
    analysis.warnings = this.generateWarnings(analysis);

    return analysis;
  }

  /**
   * Generate section allocation recommendations based on available data
   */
  generateRecommendations(analysis) {
    const { students, facilitators } = analysis;
    const unassignedCount = students.unassigned;
    const availableFacilitators = facilitators.available;

    if (unassignedCount === 0) {
      return {
        suggestedSections: 0,
        strategy: 'none',
        reason: 'All students are already assigned to sections'
      };
    }

    if (availableFacilitators === 0) {
      return {
        suggestedSections: Math.ceil(unassignedCount / this.maxRatio),
        strategy: 'no_facilitators',
        reason: 'No available facilitators - using maximum ratio',
        avgStudentsPerSection: Math.ceil(unassignedCount / Math.ceil(unassignedCount / this.maxRatio)),
        canAssignEditingLecturer: true,
        sectionsWithoutFacilitators: Math.ceil(unassignedCount / this.maxRatio)
      };
    }

    // Ideal case: 1:25 ratio
    const idealSections = Math.ceil(unassignedCount / this.defaultTargetRatio);
    
    if (idealSections <= availableFacilitators) {
      return {
        suggestedSections: idealSections,
        strategy: 'ideal',
        reason: `Ideal 1:${this.defaultTargetRatio} ratio with available facilitators`,
        avgStudentsPerSection: Math.ceil(unassignedCount / idealSections),
        facilitatorsUsed: idealSections
      };
    }

    // Use all available facilitators
    const sectionsWithAllFacilitators = availableFacilitators;
    const studentsPerSection = Math.ceil(unassignedCount / sectionsWithAllFacilitators);

    if (studentsPerSection <= this.maxRatio) {
      return {
        suggestedSections: sectionsWithAllFacilitators,
        strategy: 'use_all_facilitators',
        reason: `Using all ${availableFacilitators} available facilitators`,
        avgStudentsPerSection: studentsPerSection,
        facilitatorsUsed: availableFacilitators,
        canAssignEditingLecturer: false // This strategy uses all available facilitators
      };
    }

    // Exceed max ratio - need more sections than facilitators
    const minSections = Math.ceil(unassignedCount / this.maxRatio);
    return {
      suggestedSections: minSections,
      strategy: 'exceed_capacity',
      reason: `Need ${minSections} sections to stay under 1:${this.maxRatio} ratio`,
      avgStudentsPerSection: Math.ceil(unassignedCount / minSections),
      facilitatorsUsed: availableFacilitators,
      sectionsWithoutFacilitators: minSections - availableFacilitators,
      canAssignEditingLecturer: minSections - availableFacilitators > 0
    };
  }

  /**
   * Generate warnings for potential issues
   */
  generateWarnings(analysis) {
    const warnings = [];
    const { students, facilitators, recommendations } = analysis;

    if (facilitators.total === 0) {
      warnings.push({
        type: 'no_facilitators',
        message: 'No facilitators found in course. Sections will be created without assigned facilitators.',
        severity: 'warning'
      });
    }

    if (recommendations && recommendations.avgStudentsPerSection > this.defaultTargetRatio) {
      warnings.push({
        type: 'high_ratio',
        message: `Average students per section (${recommendations.avgStudentsPerSection}) exceeds ideal ratio of 1:${this.defaultTargetRatio}`,
        severity: recommendations.avgStudentsPerSection > this.maxRatio ? 'error' : 'warning'
      });
    }

    if (recommendations && recommendations.sectionsWithoutFacilitators > 0) {
      warnings.push({
        type: 'sections_without_facilitators',
        message: `${recommendations.sectionsWithoutFacilitators} sections will not have assigned facilitators`,
        severity: 'warning'
      });
    }

    if (students.inSections > 0) {
      warnings.push({
        type: 'existing_assignments',
        message: `${students.inSections} students are already assigned to sections and will not be moved`,
        severity: 'info'
      });
    }

    return warnings;
  }

  /**
   * Create allocation plan with section names and student assignments
   */
  createAllocationPlan(students, facilitators, sectionConfig, strategy = 'balanced') {
    const unassignedStudents = this.getUnassignedStudents(students);
    const { sectionCount, nameTemplate } = sectionConfig;

    if (unassignedStudents.length === 0) {
      throw new Error('No unassigned students to allocate');
    }

    // Create section definitions
    const sections = [];
    for (let i = 0; i < sectionCount; i++) {
      const sectionNumber = i + 1;
      const facilitator = facilitators[i] || null;
      
      sections.push({
        internalName: nameTemplate.internal.replace('{number}', sectionNumber),
        externalName: nameTemplate.external.replace('{number}', sectionNumber),
        facilitator: facilitator ? {
          id: facilitator.id,
          name: facilitator.name
        } : null,
        students: [],
        maxStudents: Math.ceil(unassignedStudents.length / sectionCount)
      });
    }

    // Distribute students using selected strategy
    const studentAssignments = this.distributeStudents(unassignedStudents, sections, strategy);

    return {
      sections: studentAssignments,
      strategy,
      totalStudents: unassignedStudents.length,
      summary: {
        sectionsCreated: sectionCount,
        facilitatorsAssigned: facilitators.length,
        avgStudentsPerSection: Math.round(unassignedStudents.length / sectionCount),
        distribution: studentAssignments.map(s => ({
          name: s.externalName,
          studentCount: s.students.length,
          facilitator: s.facilitator?.name || 'Unassigned'
        }))
      }
    };
  }

  /**
   * Distribute students among sections using specified strategy
   */
  distributeStudents(students, sections, strategy) {
    let sortedStudents = [...students];

    // Apply sorting based on strategy
    switch (strategy) {
      case 'alphabetical':
        sortedStudents.sort((a, b) => a.sortable_name?.localeCompare(b.sortable_name) || 0);
        break;
      case 'random':
        sortedStudents = this.shuffleArray(sortedStudents);
        break;
      case 'balanced':
      default:
        // Keep original order but ensure balanced distribution
        break;
    }

    // Distribute students round-robin style for balanced allocation
    sortedStudents.forEach((student, index) => {
      const sectionIndex = index % sections.length;
      sections[sectionIndex].students.push({
        id: student.id,
        name: student.name,
        sortable_name: student.sortable_name,
        email: student.email || null
      });
    });

    return sections;
  }

  /**
   * Validate allocation plan before execution
   */
  validateAllocationPlan(plan, maxRatio = null) {
    const validationResults = {
      valid: true,
      errors: [],
      warnings: []
    };

    const maxAllowed = maxRatio || this.maxRatio;

    // Check section sizes
    plan.sections.forEach((section, index) => {
      if (section.students.length > maxAllowed) {
        validationResults.valid = false;
        validationResults.errors.push(
          `Section ${index + 1} (${section.externalName}) has ${section.students.length} students, exceeding maximum of ${maxAllowed}`
        );
      }

      if (section.students.length === 0) {
        validationResults.warnings.push(
          `Section ${index + 1} (${section.externalName}) has no students assigned`
        );
      }

      if (!section.facilitator) {
        validationResults.warnings.push(
          `Section ${index + 1} (${section.externalName}) has no facilitator assigned`
        );
      }
    });

    // Check for duplicate students
    const allStudentIds = [];
    plan.sections.forEach(section => {
      section.students.forEach(student => {
        if (allStudentIds.includes(student.id)) {
          validationResults.valid = false;
          validationResults.errors.push(
            `Student ${student.name} (${student.id}) is assigned to multiple sections`
          );
        }
        allStudentIds.push(student.id);
      });
    });

    return validationResults;
  }

  // Helper methods
  getUnassignedStudents(students, existingSections = []) {
    // In a real implementation, this would check which students are already in sections
    // For now, return all students as unassigned
    return students.filter(student => {
      // Check if student is in any existing section
      return !existingSections.some(section => 
        section.students && section.students.some(s => s.id === student.id)
      );
    });
  }

  hasSectionAssignment(facilitator, existingSections = []) {
    // Check if facilitator is already assigned to a section
    return existingSections.some(section => 
      section.facilitator && section.facilitator.id === facilitator.id
    );
  }

  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Generate section name templates
   */
  generateNameTemplates(baseName = 'Section') {
    return {
      internal: `${baseName} {number} (Internal)`,
      external: `${baseName} {number}`
    };
  }

  /**
   * Calculate optimal section distribution
   */
  calculateOptimalDistribution(totalStudents, facilitatorCount, targetRatio = null) {
    const target = targetRatio || this.defaultTargetRatio;
    
    // Ideal sections based on target ratio
    const idealSections = Math.ceil(totalStudents / target);
    
    // Available sections based on facilitators
    const facilitatorSections = facilitatorCount;
    
    // Minimum sections to stay under max ratio
    const minSections = Math.ceil(totalStudents / this.maxRatio);
    
    return {
      ideal: idealSections,
      facilitatorLimited: facilitatorSections,
      minimum: minSections,
      recommended: Math.max(minSections, Math.min(idealSections, facilitatorSections))
    };
  }
}

module.exports = AllocationService; 