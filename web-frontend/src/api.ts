import type { AuthUser, ReportRecord, AddReportInput, Contest } from './types';

async function apiFetch<T>(method: string, path: string, body?: unknown): Promise<T | null> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) return null;
  return res.json() as Promise<T>;
}

export const getMe = () => apiFetch<AuthUser>('GET', '/api/me');
export const getReports = () => apiFetch<ReportRecord[]>('GET', '/api/reports');
export const addReport = (data: AddReportInput) =>
  apiFetch<{ ok: boolean; error?: string }>('POST', '/api/reports', data);
export const deleteReport = (id: string) =>
  apiFetch<{ ok: boolean }>('DELETE', `/api/reports/${id}`);

export const getContests = () => apiFetch<Contest[]>('GET', '/api/contests');
export const getProblemLabels = (contestId: string) =>
  apiFetch<string[]>('GET', `/api/contests/${encodeURIComponent(contestId)}/problems`);
