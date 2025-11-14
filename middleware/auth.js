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

// Role-based access control middleware
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Access denied. Required role: ${roles.join(' or ')}` 
      });
    }

    next();
  };
};

// Check if user is admin
export const isAdmin = authorize('admin');

// Check project access (owner, member, or admin)
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

    // Admins have access to all projects
    const isAdmin = req.user.role === 'admin';
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(member => member.toString() === req.user._id.toString());

    if (!isAdmin && !isOwner && !isMember) {
      return res.status(403).json({ message: 'Access denied. You are not a member of this project' });
    }

    req.project = project;
    req.isProjectOwner = isOwner || isAdmin;
    req.isProjectMember = isMember || isOwner || isAdmin;
    next();
  } catch (error) {
    // Handle invalid ObjectId errors
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid project ID format' });
    }
    next(error);
  }
};

// Check if user is project owner or admin
export const checkProjectOwner = async (req, res, next) => {
  try {
    if (!req.project) {
      return res.status(400).json({ message: 'Project not found in request' });
    }

    const isAdmin = req.user.role === 'admin';
    const isOwner = req.project.owner.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Only project owner or admin can perform this action' });
    }

    next();
  } catch (error) {
    next(error);
  }
};

