import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import BrandPanel from '../components/BrandPanel.jsx';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate() {
    const errs = {};
    if (!form.fullName.trim()) errs.fullName = 'Full name is required.';
    if (!form.email.trim()) errs.email = 'Email is required.';
    else if (!EMAIL_REGEX.test(form.email.trim())) errs.email = 'Enter a valid email address.';
    if (!form.password) errs.password = 'Password is required.';
    else if (form.password.length < 8) errs.password = 'Use at least 8 characters.';
    if (!form.confirmPassword) errs.confirmPassword = 'Please confirm your password.';
    else if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await api.post('/auth/register', form);
      navigate('/verify-otp', { state: { userId: res.data.userId, email: res.data.email } });
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors) setErrors(data.errors);
      setServerError(data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <BrandPanel
        activeStep={0}
        title="Create your account"
        description="Sign up in a minute. We'll send a one-time code to your email to confirm it's really you before your account goes live."
      />
      <div className="form-panel">
        <div className="form-card">
          <h2>Sign up</h2>
          <p className="subhead">Fill in your details to get started.</p>

          {serverError && <div className="alert alert-error">{serverError}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                type="text"
                value={form.fullName}
                onChange={(e) => update('fullName', e.target.value)}
                className={errors.fullName ? 'has-error' : ''}
                placeholder="Jane Doe"
                autoComplete="name"
              />
              {errors.fullName && <div className="error-text">{errors.fullName}</div>}
            </div>

            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className={errors.email ? 'has-error' : ''}
                placeholder="you@example.com"
                autoComplete="email"
              />
              {errors.email && <div className="error-text">{errors.email}</div>}
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                className={errors.password ? 'has-error' : ''}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
              {errors.password && <div className="error-text">{errors.password}</div>}
            </div>

            <div className="field">
              <label htmlFor="confirmPassword">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={(e) => update('confirmPassword', e.target.value)}
                className={errors.confirmPassword ? 'has-error' : ''}
                placeholder="Re-enter your password"
                autoComplete="new-password"
              />
              {errors.confirmPassword && <div className="error-text">{errors.confirmPassword}</div>}
            </div>

            <button className="btn-primary" type="submit" disabled={loading}>
              {loading && <span className="spinner" />}
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div className="form-footer">
            Already have an account? <Link to="/login">Log in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
