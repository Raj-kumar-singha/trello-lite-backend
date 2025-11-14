import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['To Do', 'In Progress', 'Done'],
    default: 'To Do'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  dueDate: {
    type: Date
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  attachments: [{
    filename: String,
    originalName: String,
    url: String, // Cloudflare R2 public URL
    key: String, // R2 object key for deletion
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  position: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ assignee: 1 });

export default mongoose.model('Task', taskSchema);

