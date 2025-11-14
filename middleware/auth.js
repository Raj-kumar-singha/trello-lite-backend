import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } catch (error) {
    next(error);
  }
};

export const checkProjectAccess = async (req, res, next) => {
  try {
    const Project = (await import('../models/Project.js')).default;
    // Check for project ID in params (could be :id or :projectId) or body
    const projectId = req.params.id || req.params.projectId || req.body.projectId;
    
    if (!projectId) {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    // Validate MongoDB ObjectId format
    if (!projectId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid project ID format' });
    }

    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(member => member.toString() === req.user._id.toString());

    if (!isOwner && !isMember) {
      return res.status(403).json({ message: 'Access denied. You are not a member of this project' });
    }

    req.project = project;
    next();
  } catch (error) {
    // Handle invalid ObjectId errors
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid project ID format' });
    }
    next(error);
  }
};

