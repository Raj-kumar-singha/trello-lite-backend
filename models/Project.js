import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  color: {
    type: String,
    default: '#3B82F6'
  }
}, {
  timestamps: true
});

projectSchema.index({ owner: 1, members: 1 });

export default mongoose.model('Project', projectSchema);

