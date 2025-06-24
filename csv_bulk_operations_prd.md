# 📊 **CSV Bulk Operations - Micro PRD**

**Feature ID:** F11-CSV  
**Priority:** P2 (Post-MVP Enhancement)  
**Effort:** 8-12 hours development  
**Dependencies:** Core allocation system (F1-F5, F16-F19)

---

## 🎯 **FEATURE OVERVIEW**

Enable Editing Lecturers to perform bulk section management operations via CSV upload/download, providing the same functionality as the UI but for large-scale operations (100+ students, 10+ sections).

**Core Principle:** *"Everything the UI can do, CSV can do in bulk"*

---

## 🔧 **TECHNICAL REQUIREMENTS**

### **API Endpoints to Implement**

```javascript
// 1. Template Generation
GET  /api/csv/template/:type
// Returns pre-populated CSV template
// Types: 'basic-sections', 'full-allocation', 'student-moves'

// 2. CSV Upload & Validation  
POST /api/csv/validate
// Validates CSV format + Canvas data, returns preview

// 3. CSV Execution
POST /api/csv/execute  
// Executes validated CSV operations atomically

// 4. CSV Session Management
GET  /api/csv/session/:sessionId
POST /api/csv/session/:sessionId/rollback
```

### **CSV Templates Required**

#### **Template 1: Basic Sections (`basic-sections.csv`)**
```csv
section_name,max_students,facilitator_email,internal_notes
"Section A",25,"john.doe@acu.edu.au","Advanced students"
"Section B",25,"jane.smith@acu.edu.au","Beginner level"
```

#### **Template 2: Full Allocation (`full-allocation.csv`)**
```csv
section_name,max_students,facilitator_email,student_id,student_name,student_email
"Section A",25,"john.doe@acu.edu.au","12345","John Student","john@acu.edu.au"
"Section B",25,"jane.smith@acu.edu.au","12346","Jane Student","jane@acu.edu.au"
```

#### **Template 3: Student Moves (`student-moves.csv`)**
```csv
student_id,student_name,from_section,to_section,reason,preserve_access_days
"12345","John Student","Section A","Section B","Academic needs","7"
"12346","Jane Student","Section B","Section C","Schedule conflict","0"
```

---

## 🔄 **USER WORKFLOW**

### **Phase 1: Template Download**
```
1. User clicks "📥 Download CSV Template"  
2. System shows template options:
   - Basic Sections Only
   - Full Allocation (Sections + Students)  
   - Student Moves Between Sections
3. User selects template type
4. System generates CSV with:
   - Current course data pre-populated
   - Helpful comments/instructions
   - Example rows for guidance
```

### **Phase 2: CSV Upload & Validation**
```
1. User uploads completed CSV file
2. System validates:
   - CSV format correctness
   - Required columns present  
   - Canvas data validity (student IDs, emails)
   - Business rules (capacity limits, ratios)
3. System returns validation results:
   - ✅ Valid operations
   - ⚠️ Warnings (over capacity, etc.)
   - ❌ Errors (invalid data)
```

### **Phase 3: Preview & Execute**
```
1. System shows detailed preview:
   - "X sections will be created"
   - "Y students will be moved" 
   - "Z facilitators will be assigned"
   - Estimated execution time
2. User reviews and confirms
3. System executes ALL operations atomically
4. System provides session ID for rollback
```

---

## 🛡️ **VALIDATION RULES**

### **Format Validation**
- ✅ Required columns present
- ✅ UTF-8 encoding
- ✅ Proper CSV escaping
- ✅ Maximum file size (5MB)

### **Canvas Data Validation**  
- ✅ Student IDs exist in course
- ✅ Facilitator emails exist in Canvas
- ✅ Section names don't conflict
- ✅ No duplicate student assignments

### **Business Rules Validation**
- ✅ Student:Facilitator ratios (1:25 ideal, 1:50 max)
- ✅ Section capacity limits
- ✅ Only tool-created sections for moves
- ✅ Preserve existing non-tool sections

---

## 📋 **IMPLEMENTATION DETAILS**

### **File Processing Service**
```javascript
class CsvProcessor {
  // Parse uploaded CSV with validation
  async parseAndValidate(file, operation) { }
  
  // Generate templates with current course data
  async generateTemplate(courseId, templateType) { }
  
  // Execute bulk operations atomically  
  async executeBulkOperations(csvData, sessionId) { }
  
  // Rollback entire CSV session
  async rollbackSession(sessionId) { }
}
```

### **Frontend Components**
```javascript
// CSV Upload interface
<CsvUploadComponent 
  onTemplateDownload={handleTemplateDownload}
  onFileUpload={handleFileUpload}
  onValidationComplete={handleValidation}
  onExecute={handleExecution}
/>

// Validation Results display
<CsvValidationResults 
  validation={validationResults}
  preview={operationPreview}
  onConfirm={handleConfirm}
/>
```

### **Error Handling Strategy**
```javascript
// Atomic operations - all succeed or all fail
const executionResult = {
  success: boolean,
  sessionId: string,
  operations: {
    attempted: number,
    successful: number, 
    failed: number
  },
  rollbackAvailable: boolean,
  errors: string[]
};
```

---

## 🎯 **SUCCESS CRITERIA**

### **Functional Requirements**
- ✅ Generate accurate CSV templates with current course data
- ✅ Validate CSV format and Canvas data before execution  
- ✅ Execute bulk operations (100+ students) in <60 seconds
- ✅ Provide atomic transactions (all-or-nothing execution)
- ✅ Enable complete rollback of CSV operations
- ✅ Maintain same safety standards as UI operations

### **Performance Requirements**
- ✅ Template generation: <5 seconds
- ✅ CSV validation: <10 seconds  
- ✅ Bulk execution: <60 seconds for 100 students
- ✅ File size limit: 5MB (≈10,000 rows)

### **User Experience Requirements**
- ✅ Clear template instructions and examples
- ✅ Detailed validation feedback with specific errors
- ✅ Real-time progress indication during execution
- ✅ Comprehensive preview before execution
- ✅ One-click rollback functionality

---

## 🔗 **INTEGRATION POINTS**

### **Existing Services to Leverage**
```javascript
// Reuse existing services - don't rebuild
- CanvasAPI service (all Canvas operations)
- AllocationService (validation logic)  
- Section creation/deletion (bulk wrapper)
- Student enrollment (bulk wrapper)
- Session management (rollback capability)
```

### **New Services to Create**
```javascript
- CsvProcessor (parsing, validation, template generation)
- BulkOperationService (atomic execution wrapper)
- TemplateGenerator (course-aware CSV generation)
```

---

## 📊 **TESTING STRATEGY**

### **Unit Tests**
- ✅ CSV parsing with various formats
- ✅ Validation logic for all business rules
- ✅ Template generation accuracy
- ✅ Error handling for malformed data

### **Integration Tests**  
- ✅ End-to-end CSV upload workflow
- ✅ Canvas API integration with bulk operations
- ✅ Rollback functionality verification
- ✅ Large file processing (1000+ students)

### **User Acceptance Tests**
- ✅ Template download and completion by real users
- ✅ Error message clarity and actionability  
- ✅ Performance with realistic course sizes
- ✅ Recovery from partial failures

---

## 🚀 **IMPLEMENTATION PHASES**

### **Phase 1: Core Infrastructure (4 hours)**
- CSV parsing and validation service
- Template generation endpoints
- Basic file upload interface

### **Phase 2: Bulk Operations (4 hours)**
- Atomic execution wrapper  
- Session-based rollback
- Progress tracking and feedback

### **Phase 3: User Experience (4 hours)**
- Template download UI
- Validation results display
- Error handling and recovery
- Documentation and help text

---

## 🔄 **ROLLBACK & SAFETY**

### **Session-Based Operations**
```javascript
// Every CSV execution creates a session
const session = {
  id: "csv_session_abc123",
  operations: [
    { type: "section_create", canvasId: "123", toolId: "ACU_SM_..." },
    { type: "student_enroll", enrollmentId: "456", sectionId: "123" }
  ],
  rollbackAvailable: true,
  createdAt: "2025-06-24T10:30:00Z"
};
```

### **Rollback Process**
```javascript
// POST /api/csv/session/:sessionId/rollback
// 1. Find all operations in session
// 2. Reverse each operation (delete sections, unenroll students)
// 3. Verify rollback completion
// 4. Return status report
```

---

## 📝 **ADDITIONAL NOTES**

### **AI Implementation Guidance**
- **Reuse existing services** - Don't rewrite Canvas API calls
- **Follow existing patterns** - Use same error handling as UI
- **Maintain consistency** - Same validation rules as manual operations  
- **Atomic operations** - All CSV operations succeed or all fail
- **Session tracking** - Every CSV operation gets a rollback session ID

### **Key Files to Modify**
```
/routes/csv.js (new)
/services/csvProcessor.js (new)  
/services/bulkOperationService.js (new)
/public/csv-upload.html (new UI component)
```

### **Dependencies**
- **multer** - File upload handling
- **papaparse** - CSV parsing library
- **Existing CanvasAPI service** - All Canvas operations
- **Existing AllocationService** - Validation logic

---

**🎯 End Result:** Editing Lecturers can perform complex bulk operations (create 20 sections + assign 200 students + assign 5 facilitators) via a single CSV upload, with full validation, preview, and rollback capability.