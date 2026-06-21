import { Router } from 'express';
import { fetchContests, fetchProblemIds } from '../../api/atcoder';

export const contestsRouter = Router();

contestsRouter.get('/', async (_req, res, next) => {
  try {
    res.json(await fetchContests());
  } catch (e) { next(e); }
});

contestsRouter.get('/:id/problems', async (req, res, next) => {
  try {
    res.json(await fetchProblemIds(req.params.id));
  } catch (e) { next(e); }
});
