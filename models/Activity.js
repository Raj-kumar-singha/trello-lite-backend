import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['task_created', 'task_updated', 'task_deleted', 'task_assigned', 'task_status_changed', 'comment_added', 'member_added', 'member_removed'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

activitySchema.index({ project: 1, createdAt: -1 });

export default mongoose.model('Activity', activitySchema);

