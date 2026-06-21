import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe, getReports, addReport, deleteReport, getContests, getProblemLabels } from '../api';
import type { AuthUser, ReportRecord, AddReportInput, ContestType, Contest } from '../types';

const TYPE_BADGE: Record<string, string> = {
  ABC: 'primary', ARC: 'success', AGC: 'danger',
  'AHC-Short': 'warning', 'AHC-Long': 'warning',
  AWC: 'info', Other: 'secondary',
};

const DEFAULT_PROBLEMS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

function detectType(id: string, duration: number): ContestType {
  const lower = id.toLowerCase();
  if (lower.startsWith('abc')) return 'ABC';
  if (lower.startsWith('arc')) return 'ARC';
  if (lower.startsWith('agc')) return 'AGC';
  if (lower.startsWith('awc')) return 'AWC';
  if (lower.startsWith('ahc')) return duration < 86400 ? 'AHC-Short' : 'AHC-Long';
  return 'Other';
}

function epochToDate(epoch: number): string {
  return new Date(epoch * 1000).toISOString().slice(0, 10);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const emptyForm = (): AddReportInput => ({
  contestName: '', contestId: '', contestType: 'Other', contestStartDate: todayDate(),
  solvedProblems: [], comment: '',
});

export default function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<AddReportInput>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [contests, setContests] = useState<Contest[]>([]);
  const [contestIdInput, setContestIdInput] = useState('');
  const [suggestions, setSuggestions] = useState<Contest[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [problemLabels, setProblemLabels] = useState<string[]>(DEFAULT_PROBLEMS);
  const [loadingProblems, setLoadingProblems] = useState(false);
  const suggestionsRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    Promise.all([getMe(), getReports()]).then(([me, reps]) => {
      if (!me) { navigate('/'); return; }
      setUser(me);
      setReports(reps ?? []);
      setLoading(false);
    });
  }, [navigate]);

  function openModal() {
    setForm(emptyForm());
    setContestIdInput('');
    setSuggestions([]);
    setShowSuggestions(false);
    setProblemLabels(DEFAULT_PROBLEMS);
    setFormError('');
    setShowModal(true);

    if (contests.length === 0) {
      getContests().then(c => setContests(c ?? []));
    }
  }

  function handleContestIdChange(value: string) {
    setContestIdInput(value);
    const lower = value.toLowerCase().trim();

    if (lower.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
    } else {
      const filtered = contests
        .filter(c => c.id.includes(lower) || c.title.toLowerCase().includes(lower))
        .slice(0, 10);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    }

    const exact = contests.find(c => c.id === lower);
    if (exact) {
      applyContest(exact);
    } else {
      setForm(p => ({
        ...p,
        contestId: value,
        contestName: value,
        contestType: detectType(value, 0),
        contestStartDate: todayDate(),
        solvedProblems: [],
      }));
      setProblemLabels(DEFAULT_PROBLEMS);
    }
  }

  function applyContest(contest: Contest) {
    setContestIdInput(contest.id);
    setShowSuggestions(false);
    setForm(p => ({
      ...p,
      contestId: contest.id,
      contestName: contest.title,
      contestType: detectType(contest.id, contest.duration_second),
      contestStartDate: epochToDate(contest.start_epoch_second),
      solvedProblems: [],
    }));

    setLoadingProblems(true);
    getProblemLabels(contest.id).then(labels => {
      setProblemLabels(labels && labels.length > 0 ? labels : DEFAULT_PROBLEMS);
      setLoadingProblems(false);
    });
  }

  async function handleDelete(id: string) {
    if (!confirm('この記録を削除しますか？')) return;
    await deleteReport(id);
    setReports(prev => prev.filter(r => r.id !== id));
  }

  async function handleSubmit() {
    setFormError('');
    if (!form.contestId.trim()) { setFormError('コンテストIDを入力してください'); return; }
    setSubmitting(true);
    const result = await addReport(form);
    setSubmitting(false);
    if (!result) return;
    if (result.error) { setFormError(result.error); return; }

    setShowModal(false);
    setLoading(true);
    const reps = await getReports();
    setReports(reps ?? []);
    setLoading(false);
  }

  function toggleProblem(label: string) {
    setForm(prev => ({
      ...prev,
      solvedProblems: prev.solvedProblems.includes(label)
        ? prev.solvedProblems.filter(l => l !== label)
        : [...prev.solvedProblems, label],
    }));
  }

  const knownContest = form.contestId
    ? contests.find(c => c.id === form.contestId.toLowerCase())
    : undefined;

  return (
    <>
      {/* Navbar */}
      <nav className="navbar navbar-light bg-white border-bottom px-4">
        <span className="navbar-brand fw-bold">AtCoder 参加記録</span>
        <div className="d-flex align-items-center gap-3">
          {user && (
            <span className="d-flex align-items-center gap-2">
              <img src={user.avatarUrl} width={28} height={28} className="rounded-circle" alt="" />
              <span className="small text-muted">{user.displayName}</span>
            </span>
          )}
          <a href="/auth/logout" className="btn btn-sm btn-outline-secondary">ログアウト</a>
        </div>
      </nav>

      {/* Main */}
      <div className="container py-4" style={{ maxWidth: 900 }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h5 mb-0">参加記録</h2>
          <button className="btn btn-primary btn-sm" onClick={openModal}>
            ＋ 過去の結果を追加
          </button>
        </div>

        {loading && <div className="text-center py-5 text-muted">読み込み中...</div>}

        {!loading && reports.length === 0 && (
          <div className="text-center py-5 text-muted">参加記録がありません</div>
        )}

        {!loading && reports.length > 0 && (
          <div className="table-responsive">
            <table className="table table-hover bg-white rounded shadow-sm">
              <thead className="table-light">
                <tr>
                  <th>コンテスト</th>
                  <th>種別</th>
                  <th>日付</th>
                  <th>解いた問題</th>
                  <th>感想</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.id}>
                    <td>{r.contestName}</td>
                    <td>
                      <span className={`badge bg-${TYPE_BADGE[r.contestType] ?? 'secondary'}`}>
                        {r.contestType}
                      </span>
                    </td>
                    <td className="text-nowrap">{r.contestStartDate}</td>
                    <td>{r.solvedProblems.length > 0 ? r.solvedProblems.join(', ') : 'なし'}</td>
                    <td className="text-muted small">{r.comment}</td>
                    <td>
                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => handleDelete(r.id)}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add modal */}
      {showModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">過去の参加結果を追加</h5>
                <button className="btn-close" onClick={() => setShowModal(false)} />
              </div>
              <div className="modal-body">

                {/* Contest ID with autocomplete */}
                <div className="mb-3 position-relative">
                  <label className="form-label">コンテストID <span className="text-danger">*</span></label>
                  <input
                    className="form-control"
                    placeholder="例: abc390"
                    value={contestIdInput}
                    autoComplete="off"
                    onChange={e => handleContestIdChange(e.target.value)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  />
                  {showSuggestions && (
                    <ul
                      ref={suggestionsRef}
                      className="list-group position-absolute w-100 shadow"
                      style={{ zIndex: 1050, maxHeight: 200, overflowY: 'auto' }}
                    >
                      {suggestions.map(c => (
                        <li
                          key={c.id}
                          className="list-group-item list-group-item-action py-1 px-3"
                          style={{ cursor: 'pointer' }}
                          onMouseDown={() => applyContest(c)}
                        >
                          <span className="text-muted small me-2">{c.id}</span>
                          {c.title}
                        </li>
                      ))}
                    </ul>
                  )}
                  {form.contestId && (
                    <div className="form-text">
                      {knownContest ? (
                        <>
                          {form.contestName}{' '}
                          <span className={`badge bg-${TYPE_BADGE[form.contestType] ?? 'secondary'}`}>
                            {form.contestType}
                          </span>
                          {' '}{form.contestStartDate}
                        </>
                      ) : (
                        <>
                          未知のコンテスト —{' '}
                          <span className="badge bg-secondary">Other</span>
                          として登録されます
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Problem selection */}
                <div className="mb-3">
                  <label className="form-label">解いた問題</label>
                  {loadingProblems ? (
                    <div className="text-muted small">問題を取得中...</div>
                  ) : (
                    <div className="d-flex gap-2 flex-wrap">
                      {problemLabels.map(label => (
                        <button
                          key={label}
                          type="button"
                          className={`btn btn-sm ${form.solvedProblems.includes(label) ? 'btn-primary' : 'btn-outline-secondary'}`}
                          onClick={() => toggleProblem(label)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Comment */}
                <div className="mb-3">
                  <label className="form-label">感想（任意）</label>
                  <input
                    className="form-control"
                    placeholder="一言感想"
                    maxLength={200}
                    value={form.comment}
                    onChange={e => setForm(p => ({ ...p, comment: e.target.value }))}
                  />
                </div>

                {formError && <div className="text-danger small">{formError}</div>}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>キャンセル</button>
                <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? '追加中...' : '追加'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
