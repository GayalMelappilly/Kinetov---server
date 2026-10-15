import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AdminAuthRequest extends Request {
  admin?: {
    id: string;
    username: string;
  };
}

export const authenticateAdmin = (
  req: AdminAuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. Admin access required.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'custom_battery_secret_jwt_key_2026_super_secure'
    ) as { id: string; username: string };

    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};
