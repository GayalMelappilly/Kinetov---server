import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import { authenticateAdmin, AdminAuthRequest } from '../middleware/auth';

const router = Router();

// Admin Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const admin = await prisma.admin.findUnique({
      where: { username },
    });

    if (!admin) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      process.env.JWT_SECRET || 'custom_battery_secret_jwt_key_2026_super_secure',
      { expiresIn: '24h' }
    );

    return res.json({
      message: 'Login successful',
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
      },
    });
  } catch (error: any) {
    console.error('Admin login error:', error);
    return res.status(500).json({ error: 'Server error during login.' });
  }
});

// Admin Profile / Check Session
router.get('/me', authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin?.id },
      select: { id: true, username: true, name: true, createdAt: true },
    });

    if (!admin) {
      return res.status(404).json({ error: 'Admin user not found.' });
    }

    return res.json({ admin });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch admin profile.' });
  }
});

export default router;
