import express from 'express';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/users
// @desc    Get all users (for adding to projects)
// @access  Private
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
      .select('name email avatar _id')
      .limit(20);

    // Format response to include both _id and id for compatibility
    const formattedUsers = users.map(user => ({
      _id: user._id,
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar
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
    const user = await User.findById(req.params.id).select('name email avatar');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

export default router;

