import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe, getReports, addReport, deleteReport } from '../api';
import type { AuthUser, ReportRecord, AddReportInput, ContestType } from '../types';

const CONTEST_TYPES: ContestType[] = ['ABC', 'ARC', 'AGC', 'AHC-Short', 'AHC-Long', 'AWC', 'Other'];

const TYPE_BADGE: Record<string, string> = {
  ABC: 'primary', ARC: 'success', AGC: 'danger',
  'AHC-Short': 'warning', 'AHC-Long': 'warning',
  AWC: 'info', Other: 'secondary',
};

const PROBLEM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

const emptyForm = (): AddReportInput => ({
  contestName: '', contestId: '', contestType: '', contestStartDate: '',
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

  useEffect(() => {
    Promise.all([getMe(), getReports()]).then(([me, reps]) => {
      if (!me) { navigate('/'); return; }
      setUser(me);
      setReports(reps ?? []);
      setLoading(false);
    });
  }, [navigate]);

  async function handleDelete(id: string) {
    if (!confirm('この記録を削除しますか？')) return;
    await deleteReport(id);
    setReports(prev => prev.filter(r => r.id !== id));
  }

  async function handleSubmit() {
    setFormError('');
    setSubmitting(true);
    const result = await addReport(form);
    setSubmitting(false);
    if (!result) return;
    if (result.error) { setFormError(result.error); return; }

    setShowModal(false);
    setForm(emptyForm());
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
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
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
                <div className="mb-3">
                  <label className="form-label">コンテスト名 <span className="text-danger">*</span></label>
                  <input
                    className="form-control"
                    placeholder="例: AtCoder Beginner Contest 390"
                    value={form.contestName}
                    onChange={e => setForm(p => ({ ...p, contestName: e.target.value }))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">
                    コンテストID <span className="text-muted small">（任意・入力するとDiscord報告と紐づく）</span>
                  </label>
                  <input
                    className="form-control"
                    placeholder="例: abc390"
                    value={form.contestId}
                    onChange={e => setForm(p => ({ ...p, contestId: e.target.value }))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">種別 <span className="text-danger">*</span></label>
                  <select
                    className="form-select"
                    value={form.contestType}
                    onChange={e => setForm(p => ({ ...p, contestType: e.target.value }))}
                  >
                    <option value="">選択してください</option>
                    {CONTEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">開催日 <span className="text-danger">*</span></label>
                  <input
                    type="date"
                    className="form-control"
                    value={form.contestStartDate}
                    onChange={e => setForm(p => ({ ...p, contestStartDate: e.target.value }))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">解いた問題</label>
                  <div className="d-flex gap-3 flex-wrap">
                    {PROBLEM_LABELS.map(label => (
                      <div key={label} className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`prob-${label}`}
                          checked={form.solvedProblems.includes(label)}
                          onChange={() => toggleProblem(label)}
                        />
                        <label className="form-check-label" htmlFor={`prob-${label}`}>{label}</label>
                      </div>
                    ))}
                  </div>
                </div>
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
