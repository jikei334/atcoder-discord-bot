import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { authRouter } from './routes/auth';
import { reportsRouter } from './routes/reports';
import { contestsRouter } from './routes/contests';
import { requireAuth } from './middleware/auth';

const app = express();
const PORT = process.env.WEB_PORT ? parseInt(process.env.WEB_PORT) : 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/auth', authRouter);
app.use('/api/reports', requireAuth, reportsRouter);
app.use('/api/contests', requireAuth, contestsRouter);

app.get('/api/me', requireAuth, (req, res) => {
  res.json(req.user);
});

// SPA キャッチオール（React Router に委譲）
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[web]', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Web server listening on port ${PORT}`);
});
