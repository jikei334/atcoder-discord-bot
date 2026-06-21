import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe } from '../api';

export default function LoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    getMe().then(user => {
      if (user) navigate('/dashboard');
    });
  }, [navigate]);

  const hasError = new URLSearchParams(location.search).get('error');

  return (
    <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
      <div className="card shadow-sm p-5 text-center" style={{ maxWidth: 420, width: '100%' }}>
        <h1 className="h4 mb-2">AtCoder 参加記録</h1>
        <p className="text-muted small mb-4">
          Discord アカウントでログインして<br />過去の参加記録を追加・確認できます
        </p>
        <a href="/auth/discord" className="btn btn-primary">
          Discord でログイン
        </a>
        {hasError && (
          <div className="text-danger mt-3 small">
            ログインに失敗しました。再度お試しください。
          </div>
        )}
      </div>
    </div>
  );
}
