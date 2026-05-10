import { useEffect, useState } from 'react';
import { clearToken, fetchMe, logout } from '../services/authApi';

export default function AccountPage() {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMe()
      .then((res) => setProfile(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load profile.'));
  }, []);

  const onLogout = async () => {
    try {
      await logout();
    } finally {
      clearToken();
      window.location.href = '/login-phone';
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>My Account</h1>
        {error && <p className="error-text">{error}</p>}
        {profile && (
          <div>
            <p><strong>Name:</strong> {profile.name || '-'}</p>
            <p><strong>Email:</strong> {profile.email}</p>
            <p><strong>Phone:</strong> {profile.phone}</p>
          </div>
        )}
        <button className="btn btn-secondary" onClick={onLogout}>Logout</button>
      </section>
    </main>
  );
}
