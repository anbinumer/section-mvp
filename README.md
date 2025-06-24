# Canvas Section Manager - ACU

A lightweight, **Canvas-only** section allocation tool for Australian Catholic University. This tool helps Editing Lecturers automatically allocate students into sections based on available Online Facilitators, with no external database dependencies.

## 🎯 Features

- **Canvas-Native**: Uses only Canvas API - no external database required
- **Safe Operations**: Only modifies sections created by this tool
- **Rollback Capability**: Complete undo functionality for any allocation
- **Smart Allocation**: 1:25 target ratio with 1:50 maximum override
- **Section Differentiation**: Clear identification of tool-created vs other sections
- **Real-time Progress**: Live updates during allocation process

## 🏗️ Architecture

### **Section Identification Strategies**
1. **SIS Section ID Prefix**: `ACU_SM_{timestamp}_{sectionNumber}_{sessionId}`
2. **Integration ID Metadata**: JSON metadata stored in Canvas integration_id field
3. **Session-Based Operations**: All sections in an allocation share a session ID

### **Safety Features**
- **Tool-Created Sections**: Only sections with `ACU_SM_` prefix are modified
- **Preserved Sections**: Default, manual, and other tool sections are untouched
- **Session Isolation**: Rollback affects only sections from specific allocation
- **Confirmation Dialogs**: Clear warnings before destructive operations

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- Canvas API access token
- Editing Lecturer permissions in Canvas

### Installation
```bash
# Clone the repository
git clone https://github.com/anbinumer/section-mvp.git
cd section-mvp

# Install dependencies
npm install

# Copy environment template
cp env.example .env

# Start the application
npm start
```

### Environment Variables
```bash
# Required
PORT=3000
NODE_ENV=development

# Optional
INSTITUTION_NAME="Australian Catholic University"
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📖 Usage

### 1. Connect to Canvas
- Enter your Canvas institution URL
- Provide your Canvas API token
- Specify the course ID

### 2. Analyze Course
- Review student and facilitator counts
- See existing sections (tool-created vs others)
- Get allocation recommendations

### 3. Configure Sections
- Set number of sections needed
- Configure internal and external names
- Choose allocation strategy

### 4. Execute Allocation
- Review the allocation plan
- Execute the allocation
- Monitor progress in real-time
- Use rollback if needed

## 🔧 API Endpoints

### Canvas Operations
- `POST /api/canvas/validate` - Validate credentials and permissions
- `POST /api/canvas/course-data` - Fetch comprehensive course data
- `POST /api/canvas/analyze-sections` - Analyze existing sections

### Section Management
- `POST /api/sections/create-bulk` - Create multiple sections
- `POST /api/sections/rollback` - Rollback sections by session
- `GET /api/sections/session/:sessionId` - Get session details

### Allocation Operations
- `POST /api/allocations/analyze` - Analyze allocation requirements
- `POST /api/allocations/generate-plan` - Generate allocation plan
- `POST /api/allocations/execute` - Execute full allocation

## 🛡️ Safety & Rollback

### Section Categorization
```javascript
// Tool-created sections (safe to modify)
if (section.sis_section_id.startsWith('ACU_SM_')) { /* safe */ }

// Preserved sections (never modified)
- Default sections
- SIS-imported sections  
- Manually created sections
- Sections from other tools
```

### Rollback Process
1. **Session Identification**: Find sections by session ID
2. **Safe Deletion**: Only delete tool-created sections
3. **Student Cleanup**: Remove enrollments from deleted sections
4. **Audit Trail**: Complete operation logging

## 🎨 UI/UX

- **ACU Branding**: Purple color scheme (#663399)
- **Responsive Design**: Works on desktop and mobile
- **Progress Indicators**: Clear step-by-step workflow
- **Error Handling**: Graceful error messages and recovery
- **Confirmation Dialogs**: Prevent accidental operations

## 🔒 Security

- **API Token Security**: Tokens never stored, only used for API calls
- **Rate Limiting**: Prevents API abuse
- **CORS Protection**: Secure cross-origin requests
- **Input Validation**: All inputs validated and sanitized
- **Error Sanitization**: Production-safe error messages

## 📊 Performance

- **Canvas-Only**: No database queries, faster operations
- **Bulk Operations**: Efficient batch processing
- **Progress Tracking**: Real-time status updates
- **API Optimization**: Minimal Canvas API calls

## 🚀 Deployment

### Local Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Environment Setup
```bash
NODE_ENV=production
PORT=3000
INSTITUTION_NAME="Australian Catholic University"
```

## 🔄 Rollback Operations

### When to Use Rollback
- Incorrect allocation parameters
- Need to start over
- System errors during allocation
- User requests undo

### Rollback Process
1. Navigate to execution results
2. Click "Rollback Allocation"
3. Confirm the operation
4. Monitor rollback progress
5. Verify completion

### What Gets Rolled Back
- ✅ All sections created in the session
- ✅ Student enrollments in those sections
- ❌ Other sections (preserved)
- ❌ Default sections (preserved)

## 📝 Logging

### Console Logging
- API call tracking
- Operation progress
- Error details
- Performance metrics

### Canvas Audit Trail
- Section creation timestamps
- User attribution via integration_id
- Session linking for rollback

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
- Check the troubleshooting guide
- Review Canvas API documentation
- Contact ACU Education Technology

---

**Note**: This tool is designed to work exclusively with Canvas LMS and requires no external database setup. All section identification and rollback operations use Canvas-native features for maximum portability and simplicity. 