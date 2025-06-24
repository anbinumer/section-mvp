const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema({
  // Canvas identifiers
  canvasCourseId: {
    type: String,
    required: true
  },
  canvasSectionId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Section names
  internalName: {
    type: String,
    required: true,
    trim: true
  },
  externalName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Allocation details
  facilitatorId: {
    type: String,
    required: false // Some sections might not have facilitators yet
  },
  facilitatorName: {
    type: String,
    required: false
  },
  
  // Student management
  studentCount: {
    type: Number,
    default: 0
  },
  maxStudents: {
    type: Number,
    default: 25
  },
  
  // Metadata
  createdBy: {
    type: String,
    required: true // Canvas user ID of the Editing Lecturer
  },
  allocationDate: {
    type: Date,
    default: Date.now
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['planned', 'created', 'allocated', 'error'],
    default: 'planned'
  },
  
  // Error handling
  lastError: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for performance
SectionSchema.index({ canvasCourseId: 1 });
SectionSchema.index({ canvasSectionId: 1 });
SectionSchema.index({ createdBy: 1 });
SectionSchema.index({ status: 1 });

// Instance methods
SectionSchema.methods.updateStudentCount = async function(count) {
  this.studentCount = count;
  return this.save();
};

SectionSchema.methods.markAsError = async function(errorMessage) {
  this.status = 'error';
  this.lastError = errorMessage;
  return this.save();
};

// Static methods
SectionSchema.statics.findByCourse = function(courseId) {
  return this.find({ canvasCourseId: courseId });
};

SectionSchema.statics.findByCreator = function(userId) {
  return this.find({ createdBy: userId });
};

module.exports = mongoose.model('Section', SectionSchema); 