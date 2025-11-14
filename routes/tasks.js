import express from 'express';
import { body, validationResult } from 'express-validator';
import Task from '../models/Task.js';
import Activity from '../models/Activity.js';
import User from '../models/User.js';
import { protect, checkProjectAccess } from '../middleware/auth.js';
import { sendTaskAssignmentEmail } from '../utils/emailService.js';
import multer from 'multer';
import { uploadToR2, deleteFromR2 } from '../utils/cloudflareR2.js';

// Use memory storage for multer since we'll upload directly to R2
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar|7z|mp4|mov|avi|mp3|wav/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, documents, archives, videos, and audio are allowed.'));
    }
  }
});

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/tasks
// @desc    Get tasks with filters
// @access  Private
router.get('/', async (req, res, next) => {
  try {
    const { projectId, assignee, status, search, dueDate, priority, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const query = {};
    
    if (projectId) {
      query.project = projectId;
    }
    
    if (assignee) {
      query.assignee = assignee;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (priority) {
      query.priority = priority;
    }
    
    if (dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      switch (dueDate) {
        case 'overdue':
          query.dueDate = { $lt: today };
          query.status = { $ne: 'Done' };
          break;
        case 'today':
          query.dueDate = { $gte: today, $lt: tomorrow };
          break;
        case 'thisWeek':
          query.dueDate = { $gte: today, $lt: nextWeek };
          break;
        case 'upcoming':
          query.dueDate = { $gte: nextWeek };
          break;
        case 'noDate':
          query.dueDate = { $exists: false };
          break;
      }
    }
    
    if (search) {
      const trimmedSearch = search.trim();
      if (trimmedSearch) {
        query.$or = [
          { title: { $regex: trimmedSearch, $options: 'i' } },
          { description: { $regex: trimmedSearch, $options: 'i' } }
        ];
      }
    }

    const sortOptions = {};
    // Sort by position first (for drag-and-drop ordering), then by the specified sort field
    sortOptions['position'] = 1;
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const tasks = await Task.find(query)
      .populate('project', 'name color')
      .populate('assignee', 'name email avatar')
      .populate('createdBy', 'name email avatar')
      .sort(sortOptions);

    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/tasks/:id
// @desc    Get single task
// @access  Private
router.get('/:id', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('project', 'name color owner members')
      .populate('assignee', 'name email avatar')
      .populate('createdBy', 'name email avatar');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const Project = (await import('../models/Project.js')).default;
    const project = await Project.findById(task.project._id);
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(member => member.toString() === req.user._id.toString());

    if (!isOwner && !isMember) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(task);
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/tasks
// @desc    Create a new task
// @access  Private
router.post('/', checkProjectAccess, [
  body('title').trim().notEmpty().withMessage('Task title is required')
    .isLength({ min: 3 }).withMessage('Task title must be at least 3 characters')
    .isLength({ max: 200 }).withMessage('Task title must be less than 200 characters'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('dueDate').optional().isISO8601().withMessage('Invalid due date format')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { title, description, status, priority, dueDate, assignee } = req.body;

    const task = await Task.create({
      title,
      description: description || '',
      status: status || 'To Do',
      priority: priority || 'Medium',
      dueDate: dueDate || null,
      project: req.params.projectId || req.body.projectId,
      assignee: assignee || null,
      createdBy: req.user._id
    });

    await Activity.create({
      type: 'task_created',
      description: `${req.user.name} created task "${title}"`,
      project: task.project,
      task: task._id,
      user: req.user._id
    });

    if (assignee) {
      const assignedUser = await User.findById(assignee);
      if (assignedUser) {
        await Activity.create({
          type: 'task_assigned',
          description: `${req.user.name} assigned task "${title}" to ${assignedUser.name}`,
          project: task.project,
          task: task._id,
          user: req.user._id
        });

        const project = await (await import('../models/Project.js')).default.findById(task.project);
        await sendTaskAssignmentEmail(
          assignedUser.email,
          title,
          project.name,
          req.user.name
        );
      }
    }

    const populatedTask = await Task.findById(task._id)
      .populate('project', 'name color')
      .populate('assignee', 'name email avatar')
      .populate('createdBy', 'name email avatar');

    res.status(201).json(populatedTask);
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/tasks/:id
// @desc    Update task
// @access  Private
router.put('/:id', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const Project = (await import('../models/Project.js')).default;
    const project = await Project.findById(task.project);
    const isAdmin = req.user.role === 'admin';
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(member => member.toString() === req.user._id.toString());

    if (!isAdmin && !isOwner && !isMember) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { title, description, status, priority, dueDate, assignee, position } = req.body;
    const oldStatus = task.status;
    const oldAssignee = task.assignee?.toString();

    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (status) task.status = status;
    if (priority) task.priority = priority;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (assignee !== undefined) task.assignee = assignee;
    if (position !== undefined) task.position = position;

    await task.save();

    if (oldStatus !== task.status) {
      await Activity.create({
        type: 'task_status_changed',
        description: `${req.user.name} changed task status from "${oldStatus}" to "${task.status}"`,
        project: task.project,
        task: task._id,
        user: req.user._id,
        metadata: { oldStatus, newStatus: task.status }
      });
    }

    if (assignee && oldAssignee !== assignee?.toString()) {
      const assignedUser = await User.findById(assignee);
      if (assignedUser) {
        await Activity.create({
          type: 'task_assigned',
          description: `${req.user.name} assigned task "${task.title}" to ${assignedUser.name}`,
          project: task.project,
          task: task._id,
          user: req.user._id
        });

        await sendTaskAssignmentEmail(
          assignedUser.email,
          task.title,
          project.name,
          req.user.name
        );
      }
    }

    await Activity.create({
      type: 'task_updated',
      description: `${req.user.name} updated task "${task.title}"`,
      project: task.project,
      task: task._id,
      user: req.user._id
    });

    const populatedTask = await Task.findById(task._id)
      .populate('project', 'name color')
      .populate('assignee', 'name email avatar')
      .populate('createdBy', 'name email avatar');

    res.json(populatedTask);
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete task
// @access  Private
router.delete('/:id', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const Project = (await import('../models/Project.js')).default;
    const project = await Project.findById(task.project);
    const isAdmin = req.user.role === 'admin';
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(member => member.toString() === req.user._id.toString());

    if (!isAdmin && !isOwner && !isMember) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await Activity.create({
      type: 'task_deleted',
      description: `${req.user.name} deleted task "${task.title}"`,
      project: task.project,
      task: task._id,
      user: req.user._id
    });

    // Delete attachments from R2 if they exist
    if (task.attachments && task.attachments.length > 0) {
      for (const attachment of task.attachments) {
        if (attachment.key) {
          try {
            await deleteFromR2(attachment.key);
          } catch (r2Error) {
            console.error('Error deleting attachment from R2 (continuing anyway):', r2Error);
            // Continue even if R2 deletion fails
          }
        }
      }
    }

    await Task.findByIdAndDelete(req.params.id);

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/tasks/:id/attachments
// @desc    Upload attachment to task
// @access  Private
router.post('/:id/attachments', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const Project = (await import('../models/Project.js')).default;
    const project = await Project.findById(task.project);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(member => member.toString() === req.user._id.toString());

    if (!isOwner && !isMember) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Upload to Cloudflare R2
    const uploadResult = await uploadToR2(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    // Save attachment info to task
    task.attachments.push({
      filename: uploadResult.filename,
      originalName: uploadResult.originalName,
      url: uploadResult.url,
      key: uploadResult.key,
      size: uploadResult.size,
      uploadedAt: new Date()
    });

    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate('project', 'name color')
      .populate('assignee', 'name email avatar')
      .populate('createdBy', 'name email avatar');

    res.json(populatedTask);
  } catch (error) {
    console.error('Error uploading attachment:', error);
    next(error);
  }
});

// @route   DELETE /api/tasks/:id/attachments/:attachmentId
// @desc    Delete attachment from task
// @access  Private
router.delete('/:id/attachments/:attachmentId', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const Project = (await import('../models/Project.js')).default;
    const project = await Project.findById(task.project);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(member => member.toString() === req.user._id.toString());

    if (!isOwner && !isMember) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const attachment = task.attachments.id(req.params.attachmentId);
    if (!attachment) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    // Delete from Cloudflare R2 if key exists
    if (attachment.key) {
      try {
        await deleteFromR2(attachment.key);
      } catch (r2Error) {
        console.error('Error deleting from R2 (continuing anyway):', r2Error);
        // Continue even if R2 deletion fails
      }
    }

    task.attachments.pull(req.params.attachmentId);
    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate('project', 'name color')
      .populate('assignee', 'name email avatar')
      .populate('createdBy', 'name email avatar');

    res.json(populatedTask);
  } catch (error) {
    console.error('Error deleting attachment:', error);
    next(error);
  }
});

export default router;

