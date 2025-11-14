import express from 'express';
import Activity from '../models/Activity.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/activities/project/:projectId
// @desc    Get all activities for a project
// @access  Private
router.get('/project/:projectId', async (req, res, next) => {
  try {
    const Project = (await import('../models/Project.js')).default;
    const project = await Project.findById(req.params.projectId);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const isAdmin = req.user.role === 'admin';
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(member => member.toString() === req.user._id.toString());

    if (!isAdmin && !isOwner && !isMember) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const activities = await Activity.find({ project: req.params.projectId })
      .populate('user', 'name email avatar')
      .populate('task', 'title')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(activities);
  } catch (error) {
    next(error);
  }
});

export default router;

