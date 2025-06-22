# Canvas Section Manager

A powerful web application that automates student allocation into Canvas LMS sections based on available facilitators, designed specifically for Australian Catholic University.

## 🎯 Purpose

This tool helps **Editing Lecturers** automatically allocate students into sections in Canvas LMS courses based on the number of assigned **Online Facilitators**. It streamlines the manual process of creating sections and enrolling students, ensuring optimal facilitator-to-student ratios.

## ✨ Features

### Core Functionality
- **Canvas Integration**: Secure API connection with Canvas LMS
- **Role Validation**: Ensures only Editing Lecturers can use the tool
- **Intelligent Analysis**: Analyzes course data and recommends optimal section distribution
- **Flexible Allocation**: Multiple strategies for student distribution (balanced, alphabetical, random)
- **Dual Naming**: Support for both internal (educator-facing) and external (student-facing) section names
- **Audit Logging**: Complete tracking of all allocation activities

### User Experience
- **Step-by-Step Workflow**: Guided 4-step process from connection to execution
- **Real-time Preview**: See allocation results before execution
- **Progress Tracking**: Live updates during bulk operations
- **Error Handling**: Comprehensive error messages and recovery options
- **ACU Branding**: Professional UI with ACU color scheme and styling

### Technical Features
- **Rate Limiting**: Respects Canvas API limits with automatic throttling
- **Bulk Operations**: Efficient handling of large courses
- **Database Logging**: MongoDB storage for audit trails and rollback capability
- **Security**: Helmet.js security headers and input validation
- **Responsive Design**: Works on desktop and mobile devices

## 🏗️ Architecture

### Backend (Node.js + Express)
- **Canvas API Service**: Comprehensive Canvas LMS integration
- **Allocation Service**: Intelligent student distribution algorithms
- **Database Models**: MongoDB schemas for sections and audit logs
- **RESTful APIs**: Clean API endpoints for frontend communication

### Frontend (Vanilla JS + Tailwind CSS)
- **Progressive Enhancement**: Works without JavaScript for basic functionality
- **Modern UI**: Clean, card-based design with smooth animations
- **Responsive Layout**: Mobile-first design approach
- **Accessibility**: WCAG-compliant interface elements

### Database (MongoDB)
- **Section Management**: Track created sections and their status
- **Audit Logging**: Complete history of allocation operations
- **Error Tracking**: Detailed error logs for troubleshooting

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ and npm
- MongoDB 4.4+
- Canvas LMS account with Editing Lecturer permissions
- Canvas API token

### Installation

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd section-mvp
   npm install
   ```

2. **Configure environment**
   ```bash
   cp env.example .env
   # Edit .env with your MongoDB connection string
   ```

3. **Start the application**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

4. **Access the application**
   - Open http://localhost:3000 in your web browser
   - Enter your Canvas URL, API token, and course ID
   - Follow the guided workflow

### Canvas API Token Setup

1. Log into your Canvas account
2. Go to **Account → Settings**
3. Scroll to **Approved Integrations**
4. Click **+ New Access Token**
5. Enter purpose: "Section Manager"
6. Set expiry date (optional)
7. Click **Generate Token**
8. **Important**: Copy the token immediately - you won't see it again!

## 📋 Usage Workflow

### Step 1: Connect to Canvas
- Enter your Canvas institution URL
- Provide your Canvas API token
- Specify the course ID
- System validates credentials and permissions

### Step 2: Analyze Course Data
- Review student and facilitator counts
- See existing sections
- Get intelligent recommendations for optimal allocation
- View warnings for potential issues

### Step 3: Configure Sections
- Set number of sections to create
- Define internal and external section names
- Choose student distribution strategy
- Generate and review allocation preview

### Step 4: Execute Allocation
- Review final allocation plan
- Execute section creation and student enrollment
- Monitor progress in real-time
- View completion summary and audit log

## 🔧 API Endpoints

### Canvas Integration
- `POST /api/canvas/validate` - Validate credentials and permissions
- `POST /api/canvas/course-data` - Fetch comprehensive course data
- `POST /api/canvas/test-connection` - Test Canvas connectivity

### Section Management
- `POST /api/sections/create-bulk` - Create multiple sections
- `POST /api/sections/enroll-students` - Bulk student enrollment
- `GET /api/sections/course/:courseId` - Get sections for a course

### Allocation Management
- `POST /api/allocations/analyze` - Analyze course for recommendations
- `POST /api/allocations/generate-plan` - Create detailed allocation plan
- `POST /api/allocations/execute` - Execute full allocation process
- `GET /api/allocations/history/:courseId` - Get allocation history

## 🛡️ Security Features

- **Rate Limiting**: Prevents API abuse
- **Input Validation**: All inputs sanitized and validated
- **CORS Protection**: Configurable cross-origin resource sharing
- **Security Headers**: Helmet.js for security hardening
- **Error Handling**: Secure error messages without sensitive data exposure

## 📊 Allocation Strategies

### Balanced (Default)
- Evenly distributes students across all sections
- Maintains consistent section sizes
- Best for general use cases

### Alphabetical
- Sorts students by name before distribution
- Useful for creating alphabetically organized sections
- Helps with administrative tasks

### Random
- Randomly shuffles students before allocation
- Ensures unpredictable groupings
- Good for avoiding pre-existing student clusters

## 🔍 Monitoring & Logging

- **Audit Trails**: Complete history of all allocation operations
- **Error Tracking**: Detailed error logs with stack traces
- **Performance Metrics**: API call counts and execution times
- **Status Monitoring**: Real-time status of section creation and enrollment

## 🚧 Known Limitations

- **SIS Integration**: May conflict with SIS-managed enrollments
- **Cross-listing**: Not compatible with cross-listed courses
- **Section Limits**: Subject to Canvas platform limits on sections per course
- **Rollback**: Limited rollback capabilities - use with caution

## 🔧 Development

### Project Structure
```
section-mvp/
├── config/          # Database configuration
├── models/          # MongoDB schemas
├── routes/          # API route handlers
├── services/        # Business logic services
├── public/          # Frontend assets
├── server.js        # Main application entry point
└── package.json     # Dependencies and scripts
```

### Adding New Features
1. Backend changes go in `services/` and `routes/`
2. Frontend changes go in `public/`
3. Database schemas in `models/`
4. Follow existing error handling patterns

### Environment Variables
- `PORT`: Server port (default: 3000)
- `MONGODB_URI`: MongoDB connection string
- `NODE_ENV`: Environment (development/production)
- `SESSION_SECRET`: Session encryption key

## 📈 Future Enhancements

- **LTI Integration**: Direct Canvas app integration
- **Advanced Analytics**: Detailed allocation statistics
- **Bulk Course Support**: Process multiple courses simultaneously
- **Template Management**: Save and reuse allocation templates
- **Notification System**: Email notifications for completion
- **API Rate Optimization**: Smart batching and caching

## 🤝 Contributing

1. Follow the existing code style and patterns
2. Add comprehensive error handling
3. Include logging for debugging
4. Test with various Canvas configurations
5. Update documentation for new features

## 📞 Support

For technical issues or questions:
- Check the application logs in the console
- Review the Canvas API documentation
- Ensure proper permissions in Canvas
- Verify MongoDB connectivity

## 📄 License

This project is developed for Australian Catholic University. All rights reserved.

---

**Version**: 1.0.0  
**Last Updated**: December 2024  
**Developed for**: Australian Catholic University 