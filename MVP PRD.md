# Canvas Section Manager — MVP PRD

## 1. Overview

This tool helps **Editing Lecturers** auto-allocate students into sections in Canvas LMS based on the number of assigned **Online Facilitators** (Canvas role: `Teacher`). The tool is external (not LTI) and connects to Canvas using API token, course ID, and Canvas URL.

## 2. Core Users

- **Editing Lecturer**: Primary user (Canvas role: `Editing Lecturer`)
- **Online Facilitators**: Allocation targets (Canvas role: `Teacher`)
- **Course Coordinators**: Passive viewers (Canvas role: `Course Coordinator`)
- **Students**: Assigned based on logic (Canvas role: `Student`)

## 3. Features (MVP Scope)

### F1. Canvas Course Connect
- Form to input Canvas URL, API token, course ID
- Authenticates user and verifies role is `Editing Lecturer`

### F2. Fetch Course Data
- Number of students
- Number of online facilitators (teachers)
- Existing sections (including the default)

### F3. Auto-Allocation Logic
- Suggest number of sections and student distribution
- Target: 1:25 student/facilitator ratio
- Allow override up to 1:50 max if facilitators are few

### F4. Section Naming
- Allow entry of both:
  - **Internal name** (educator-facing)
  - **External name** (student-facing, posted to Canvas)
- External name is pushed to Canvas via API
- Internal name stored locally with section mapping

### F5. Confirmation & Sync
- Review screen showing:
  - Facilitators, section names, student counts
- On confirm:
  - Create sections in Canvas (external name)
  - Assign students to sections
  - Log everything in MongoDB

## 4. UI/UX Style

- Branding: ACU style guide colors (primary: `#663399`)
- Fonts: System stack (Lato / Helvetica Neue / Segoe UI)
- Layout: Minimalist, card-based, Canvas-inspired
- Tailwind CSS with rounded cards, soft shadows, responsive design

## 5. Tech Stack

- Frontend: Tailwind CSS + basic HTML/JS templates (or React optional)
- Backend: Express.js + MongoDB
- Canvas API: used for enrollments, section creation, and student assignment