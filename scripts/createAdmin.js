import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get admin details from command line arguments or use defaults
    const args = process.argv.slice(2);
    const email = args[0] || 'admin@example.com';
    const password = args[1] || 'admin123';
    const name = args[2] || 'Admin User';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      if (existingAdmin.role === 'admin') {
        console.log(`Admin user with email ${email} already exists!`);
        process.exit(0);
      } else {
        // Update existing user to admin
        existingAdmin.role = 'admin';
        // Only update password if a new one is provided
        if (password && password !== 'admin123') {
          existingAdmin.password = password; // Will be hashed by pre-save hook
        }
        await existingAdmin.save();
        console.log(`✅ User ${email} has been promoted to admin!`);
        console.log('📧 Email:', existingAdmin.email);
        console.log('👤 Name:', existingAdmin.name);
        if (password && password !== 'admin123') {
          console.log('🔑 Password updated');
        }
        process.exit(0);
      }
    }

    // Create new admin user
    const admin = await User.create({
      name,
      email,
      password,
      role: 'admin'
    });

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email:', admin.email);
    console.log('👤 Name:', admin.name);
    console.log('🔑 Password:', password);
    console.log('⚠️  Please change the password after first login!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  }
};

createAdmin();

