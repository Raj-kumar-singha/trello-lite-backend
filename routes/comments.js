import express from 'express';
import { body, validationResult } from 'express-validator';
import Comment from '../models/Comment.js';
import Task from '../models/Task.js';
import Activity from '../models/Activity.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/comments/task/:taskId
// @desc    Get all comments for a task
// @access  Private
router.get('/task/:taskId', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const Project = (await import('../models/Project.js')).default;
    const project = await Project.findById(task.project);
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(member => member.toString() === req.user._id.toString());

    if (!isOwner && !isMember) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const comments = await Comment.find({ task: req.params.taskId })
      .populate('author', 'name email avatar')
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/comments
// @desc    Create a new comment
// @access  Private
router.post('/', [
  body('content').trim().notEmpty().withMessage('Comment content is required'),
  body('taskId').notEmpty().withMessage('Task ID is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { content, taskId } = req.body;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const Project = (await import('../models/Project.js')).default;
    const project = await Project.findById(task.project);
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(member => member.toString() === req.user._id.toString());

    if (!isOwner && !isMember) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const comment = await Comment.create({
      content,
      task: taskId,
      author: req.user._id
    });

    await Activity.create({
      type: 'comment_added',
      description: `${req.user.name} added a comment`,
      project: task.project,
      task: task._id,
      user: req.user._id
    });

    const populatedComment = await Comment.findById(comment._id)
      .populate('author', 'name email avatar');

    res.status(201).json(populatedComment);
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/comments/:id
// @desc    Update comment
// @access  Private
router.put('/:id', [
  body('content').trim().notEmpty().withMessage('Comment content is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own comments' });
    }

    comment.content = req.body.content;
    await comment.save();

    const populatedComment = await Comment.findById(comment._id)
      .populate('author', 'name email avatar');

    res.json(populatedComment);
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/comments/:id
// @desc    Delete comment
// @access  Private
router.delete('/:id', async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const task = await Task.findById(comment.task);
    const Project = (await import('../models/Project.js')).default;
    const project = await Project.findById(task.project);
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isProjectOwner = project.owner.toString() === req.user._id.toString();

    if (comment.author.toString() !== req.user._id.toString() && !isProjectOwner) {
      return res.status(403).json({ message: 'You can only delete your own comments' });
    }

    await Comment.findByIdAndDelete(req.params.id);

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;

