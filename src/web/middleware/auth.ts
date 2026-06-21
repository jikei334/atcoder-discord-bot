import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  userId: string;
  displayName: string;
  avatarUrl: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const token = req.cookies?.token as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    req.user = jwt.verify(token, process.env.SESSION_SECRET!) as AuthUser;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
