const mongoose = require('mongoose');

const AllocationLogSchema = new mongoose.Schema({
  // Canvas identifiers
  canvasCourseId: {
    type: String,
    required: true
  },
  
  // User performing the allocation
  userId: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  
  // Allocation details
  operation: {
    type: String,
    enum: ['analyze', 'create_sections', 'allocate_students', 'rollback'],
    required: true
  },
  
  // Data snapshots
  beforeState: {
    studentCount: Number,
    facilitatorCount: Number,
    existingSections: [String], // Array of section names
  },
  
  afterState: {
    studentCount: Number,
    facilitatorCount: Number,
    sectionsCreated: [String], // Array of section names created
    studentsAllocated: Number
  },
  
  // Allocation parameters used
  parameters: {
    targetRatio: {
      type: Number,
      default: 25
    },
    maxRatio: {
      type: Number,
      default: 50
    },
    allocationStrategy: {
      type: String,
      enum: ['random', 'alphabetical', 'balanced'],
      default: 'random'
    }
  },
  
  // Results and status
  status: {
    type: String,
    enum: ['success', 'partial', 'failed'],
    required: true
  },
  
  errors: [{
    step: String,
    message: String,
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Performance metrics
  executionTime: {
    type: Number, // milliseconds
    default: 0
  },
  
  // Canvas API call tracking
  apiCalls: {
    total: { type: Number, default: 0 },
    successful: { type: Number, default: 0 },
    failed: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Indexes for querying
AllocationLogSchema.index({ canvasCourseId: 1 });
AllocationLogSchema.index({ userId: 1 });
AllocationLogSchema.index({ operation: 1 });
AllocationLogSchema.index({ status: 1 });
AllocationLogSchema.index({ createdAt: -1 }); // Most recent first

// Static methods
AllocationLogSchema.statics.findByCourse = function(courseId) {
  return this.find({ canvasCourseId: courseId }).sort({ createdAt: -1 });
};

AllocationLogSchema.statics.findByUser = function(userId) {
  return this.find({ userId: userId }).sort({ createdAt: -1 });
};

AllocationLogSchema.statics.getRecentActivity = function(limit = 10) {
  return this.find({}).sort({ createdAt: -1 }).limit(limit);
};

// Instance methods
AllocationLogSchema.methods.addError = function(step, message) {
  this.errors.push({ step, message });
  if (this.status !== 'failed') {
    this.status = 'partial';
  }
  return this.save();
};

AllocationLogSchema.methods.markAsSuccess = function() {
  this.status = 'success';
  return this.save();
};

AllocationLogSchema.methods.markAsFailed = function(errorMessage) {
  this.status = 'failed';
  if (errorMessage) {
    this.errors.push({ step: 'general', message: errorMessage });
  }
  return this.save();
};

module.exports = mongoose.model('AllocationLog', AllocationLogSchema); 