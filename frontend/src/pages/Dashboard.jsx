import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => {
        setError('Your session has expired. Please log in again.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setTimeout(() => navigate('/login'), 1200);
      });
  }, [navigate]);

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  }

  const initials = user?.fullName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="dashboard-shell">
      <div className="dashboard-card">
        {error && <div className="alert alert-error">{error}</div>}
        {user && (
          <>
            <div className="avatar">{initials}</div>
            <h2>Welcome, {user.fullName.split(' ')[0]}</h2>
            <p>{user.email} · Verified account</p>
            <button className="btn-secondary" onClick={handleLogout}>
              Log out
            </button>
          </>
        )}
        {!user && !error && <p>Loading your account…</p>}
      </div>
    </div>
  );
}
