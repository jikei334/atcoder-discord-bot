import { Router, RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../../data/db';
import { rowToReport, ContestType } from '../../data/store';

export const reportsRouter = Router();

const CONTEST_TYPES: ContestType[] = ['ABC', 'ARC', 'AGC', 'AHC-Short', 'AHC-Long', 'AWC', 'Other'];

const getReports: RequestHandler = async (req, res) => {
  const db = getPool();
  const { rows } = await db.query(
    'SELECT * FROM reports WHERE discord_user_id = $1 ORDER BY contest_start_date DESC, reported_at DESC',
    [req.user!.userId],
  );
  res.json(rows.map(rowToReport));
};

const addReport: RequestHandler = async (req, res) => {
  const { contestName, contestId, contestType, contestStartDate, solvedProblems, comment } = req.body as {
    contestName?: string;
    contestId?: string;
    contestType?: string;
    contestStartDate?: string;
    solvedProblems?: string[];
    comment?: string;
  };

  if (!contestType || !CONTEST_TYPES.includes(contestType as ContestType)) {
    res.status(400).json({ error: '種別が不正です' }); return;
  }

  const id = uuidv4();
  const effectiveContestId = contestId?.trim() || `manual-${uuidv4()}`;
  const effectiveName = contestName?.trim() || effectiveContestId;
  const effectiveDate = (contestStartDate && /^\d{4}-\d{2}-\d{2}$/.test(contestStartDate))
    ? contestStartDate
    : new Date().toISOString().slice(0, 10);
  const db = getPool();

  await db.query(
    `INSERT INTO reports (
       id, discord_user_id, discord_display_name, contest_id, contest_name,
       contest_type, contest_start_date, solved_problems, comment, reported_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (discord_user_id, contest_id) DO UPDATE SET
       discord_display_name = $3,
       contest_name         = $5,
       contest_type         = $6,
       contest_start_date   = $7,
       solved_problems      = $8,
       comment              = $9,
       reported_at          = $10`,
    [
      id,
      req.user!.userId,
      req.user!.displayName,
      effectiveContestId,
      effectiveName,
      contestType,
      effectiveDate,
      solvedProblems ?? [],
      comment?.trim() ?? '',
      new Date().toISOString(),
    ],
  );

  res.json({ ok: true });
};

const deleteReport: RequestHandler = async (req, res) => {
  const db = getPool();
  await db.query(
    'DELETE FROM reports WHERE id = $1 AND discord_user_id = $2',
    [req.params.id, req.user!.userId],
  );
  res.json({ ok: true });
};

reportsRouter.get('/', getReports);
reportsRouter.post('/', addReport);
reportsRouter.delete('/:id', deleteReport);
