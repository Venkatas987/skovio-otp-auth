import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import BrandPanel from '../components/BrandPanel.jsx';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.email.trim() || !form.password) {
      setError('Please enter both your email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/login', form);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/dashboard');
    } catch (err) {
      const data = err.response?.data;
      if (data?.requiresVerification) {
        navigate('/verify-otp', { state: { userId: data.userId, email: form.email.trim() } });
        return;
      }
      setError(data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <BrandPanel
        activeStep={2}
        title="Welcome back"
        description="Log in with your verified email and password. Only accounts that have completed email verification can sign in."
      />
      <div className="form-panel">
        <div className="form-card">
          <h2>Log in</h2>
          <p className="subhead">Enter your credentials to continue.</p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
              />
            </div>

            <button className="btn-primary" type="submit" disabled={loading}>
              {loading && <span className="spinner" />}
              {loading ? 'Logging in…' : 'Log in'}
            </button>
          </form>

          <div className="form-footer">
            New here? <Link to="/register">Create an account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
