# Backend API - Team Task Manager

Express.js REST API server for the Team Task Manager application.

## 📋 Prerequisites

- Node.js 18+ and npm
- MongoDB (local installation or MongoDB Atlas account)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Create a `.env` file in the `backend` directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/team-task-manager
# Or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/team-task-manager

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRE=7d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000,http://localhost:3001

# Email Configuration (for task assignment notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Cloudflare R2 Configuration (Optional - uses local storage if not set)
CLOUDFLARE_R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key-id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-access-key
CLOUDFLARE_R2_BUCKET_NAME=your-bucket-name
CLOUDFLARE_R2_PUBLIC_URL=https://your-custom-domain.com
```

### 3. Start the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will run on `http://localhost:5000` (or the port specified in `.env`)

## 📁 Project Structure

```
backend/
├── models/              # MongoDB Mongoose models
│   ├── User.js
│   ├── Project.js
│   ├── Task.js
│   ├── Comment.js
│   └── Activity.js
├── routes/              # Express route handlers
│   ├── auth.js          # Authentication routes
│   ├── projects.js      # Project CRUD operations
│   ├── tasks.js         # Task CRUD + attachments
│   ├── users.js         # User management
│   ├── comments.js      # Comment operations
│   └── activities.js    # Activity log
├── middleware/          # Custom middleware
│   └── auth.js          # JWT authentication & authorization
├── utils/               # Utility functions
│   ├── cloudflareR2.js  # Cloudflare R2 file storage
│   ├── emailService.js  # Email notification service
│   └── generateToken.js # JWT token generation
├── uploads/             # Local file storage (fallback)
├── server.js            # Express server entry point
├── package.json
└── README.md
```

## 🔌 API Endpoints

### Authentication (`/api/auth`)
- `POST /register` - Register new user
- `POST /login` - Login user
- `GET /me` - Get current authenticated user

### Projects (`/api/projects`)
- `GET /` - Get all projects for current user
- `GET /:id` - Get single project by ID
- `POST /` - Create new project
- `PUT /:id` - Update project
- `DELETE /:id` - Delete project
- `POST /:id/members` - Add member to project
- `DELETE /:id/members/:userId` - Remove member from project

### Tasks (`/api/tasks`)
- `GET /` - Get all tasks (supports query params: projectId, assignee, status, priority, dueDate, search)
- `GET /:id` - Get single task
- `POST /` - Create new task
- `PUT /:id` - Update task
- `DELETE /:id` - Delete task
- `POST /:id/attachments` - Upload file attachment
- `DELETE /:id/attachments/:attachmentId` - Delete attachment

### Comments (`/api/comments`)
- `GET /task/:taskId` - Get all comments for a task
- `POST /` - Create new comment
- `PUT /:id` - Update comment
- `DELETE /:id` - Delete comment

### Users (`/api/users`)
- `GET /` - Get all users (for member selection)
- `GET /:id` - Get user by ID

### Activities (`/api/activities`)
- `GET /project/:projectId` - Get all activities for a project

## 🔐 Authentication

All routes except `/api/auth/register` and `/api/auth/login` require authentication.

Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## 📦 Dependencies

- **express**: Web framework
- **mongoose**: MongoDB ODM
- **jsonwebtoken**: JWT authentication
- **bcryptjs**: Password hashing
- **multer**: File upload handling
- **nodemailer**: Email notifications
- **express-validator**: Input validation
- **cors**: Cross-origin resource sharing
- **dotenv**: Environment variable management
- **morgan**: HTTP request logging
- **@aws-sdk/client-s3**: Cloudflare R2 integration
- **@aws-sdk/s3-request-presigner**: Presigned URLs for R2

## 🗄️ Database Models

### User
- name, email, password (hashed)
- timestamps

### Project
- name, description, color
- owner (User reference)
- members (User references array)
- timestamps

### Task
- title, description
- status (To Do, In Progress, Done)
- priority (Low, Medium, High)
- dueDate, assignee, project, createdBy
- attachments array
- position (for drag-and-drop ordering)
- timestamps

### Comment
- content, task, author
- timestamps

### Activity
- description, type, project, task, user
- timestamps

## 🔧 Development

### Running in Development
```bash
npm run dev
```
Uses nodemon for automatic server restart on file changes.

### Environment Variables
All sensitive configuration should be in `.env` file. Never commit `.env` to version control.

### File Storage
- **Cloudflare R2**: Configured via environment variables
- **Local Storage**: Falls back to `backend/uploads/` directory if R2 is not configured

## 🐛 Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running locally, or
- Verify MongoDB Atlas connection string is correct
- Check network/firewall settings

### Port Already in Use
- Change `PORT` in `.env` file
- Or kill the process using port 5000

### File Upload Issues
- Check Cloudflare R2 credentials if using R2
- Verify `uploads/` directory has write permissions (for local storage)

## 📝 Notes

- All routes are protected except authentication endpoints
- File uploads are limited to 10MB
- JWT tokens expire after 7 days (configurable)
- CORS is configured to allow requests from frontend URLs
