import express from 'express';
import User from '../models/User.js';
import { protect, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/users
// @desc    Get all users (for adding to projects)
// @access  Private (All authenticated users can search for users to add to projects)
router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('name email avatar role _id')
      .limit(20);

    // Format response to include both _id and id for compatibility
    const formattedUsers = users.map(user => ({
      _id: user._id,
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role
    }));

    res.json(formattedUsers);
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/users/:id
// @desc    Get single user
// @access  Private
router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('name email avatar role');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/users/:id/role
// @desc    Update user role (Admin only)
// @access  Private (Admin only)
router.put('/:id/role', isAdmin, async (req, res, next) => {
  try {
    const { role } = req.body;
    
    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be "user" or "admin"' });
    }

    // Prevent admin from removing their own admin role
    if (req.params.id === req.user._id.toString() && role === 'user') {
      return res.status(400).json({ message: 'You cannot remove your own admin role' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select('name email avatar role _id');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/users/admin/all
// @desc    Get all users with roles (Admin only)
// @access  Private (Admin only)
router.get('/admin/all', isAdmin, async (req, res, next) => {
  try {
    const users = await User.find({})
      .select('name email avatar role _id createdAt')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    next(error);
  }
});

export default router;

