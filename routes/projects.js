import express from 'express';
import { body, validationResult } from 'express-validator';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Activity from '../models/Activity.js';
import { protect, checkProjectAccess } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/projects
// @desc    Get all projects for current user
// @access  Private
router.get('/', async (req, res, next) => {
  try {
    const projects = await Project.find({
      $or: [
        { owner: req.user._id },
        { members: req.user._id }
      ]
    })
    .populate('owner', 'name email avatar')
    .populate('members', 'name email avatar')
    .sort({ updatedAt: -1 });

    res.json(projects);
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/projects/:id
// @desc    Get single project
// @access  Private
router.get('/:id', checkProjectAccess, async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email avatar')
      .populate('members', 'name email avatar');

    res.json(project);
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/projects
// @desc    Create a new project
// @access  Private
router.post('/', [
  body('name').trim().notEmpty().withMessage('Project name is required')
    .isLength({ min: 3 }).withMessage('Project name must be at least 3 characters')
    .isLength({ max: 100 }).withMessage('Project name must be less than 100 characters')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { name, description, color } = req.body;

    const project = await Project.create({
      name,
      description: description || '',
      owner: req.user._id,
      members: [req.user._id],
      color: color || '#3B82F6'
    });

    await Activity.create({
      type: 'member_added',
      description: `${req.user.name} created the project`,
      project: project._id,
      user: req.user._id
    });

    const populatedProject = await Project.findById(project._id)
      .populate('owner', 'name email avatar')
      .populate('members', 'name email avatar');

    res.status(201).json(populatedProject);
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/projects/:id
// @desc    Update project
// @access  Private
router.put('/:id', checkProjectAccess, [
  body('name').optional().trim().notEmpty().withMessage('Project name cannot be empty')
    .isLength({ min: 3 }).withMessage('Project name must be at least 3 characters')
    .isLength({ max: 100 }).withMessage('Project name must be less than 100 characters')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { name, description, color } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (color) updateData.color = color;

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('owner', 'name email avatar')
    .populate('members', 'name email avatar');

    res.json(project);
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/projects/:id
// @desc    Delete project
// @access  Private
router.delete('/:id', checkProjectAccess, async (req, res, next) => {
  try {
    if (req.project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only project owner can delete the project' });
    }

    await Task.deleteMany({ project: req.params.id });
    await Activity.deleteMany({ project: req.params.id });
    await Project.findByIdAndDelete(req.params.id);

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/projects/:id/members
// @desc    Add member to project
// @access  Private
router.post('/:id/members', checkProjectAccess, [
  body('userId').notEmpty().withMessage('User ID is required').trim()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { userId } = req.body;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Validate MongoDB ObjectId format
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    const User = (await import('../models/User.js')).default;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is already a member (compare as strings)
    const isAlreadyMember = req.project.members.some(
      member => member.toString() === userId.toString()
    );
    
    if (isAlreadyMember) {
      return res.status(400).json({ message: 'User is already a member of this project' });
    }

    req.project.members.push(userId);
    await req.project.save();

    await Activity.create({
      type: 'member_added',
      description: `${req.user.name} added ${user.name} to the project`,
      project: req.project._id,
      user: req.user._id
    });

    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email avatar')
      .populate('members', 'name email avatar');

    res.json(project);
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/projects/:id/members/:userId
// @desc    Remove member from project
// @access  Private
router.delete('/:id/members/:userId', checkProjectAccess, async (req, res, next) => {
  try {
    if (req.project.owner.toString() === req.params.userId) {
      return res.status(400).json({ message: 'Cannot remove project owner' });
    }

    req.project.members = req.project.members.filter(
      member => member.toString() !== req.params.userId
    );
    await req.project.save();

    const User = (await import('../models/User.js')).default;
    const removedUser = await User.findById(req.params.userId);

    await Activity.create({
      type: 'member_removed',
      description: `${req.user.name} removed ${removedUser?.name || 'a member'} from the project`,
      project: req.project._id,
      user: req.user._id
    });

    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email avatar')
      .populate('members', 'name email avatar');

    res.json(project);
  } catch (error) {
    next(error);
  }
});

export default router;

