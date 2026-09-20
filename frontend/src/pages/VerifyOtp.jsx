import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import BrandPanel from '../components/BrandPanel.jsx';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds, mirrors backend default

export default function VerifyOtp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, email } = location.state || {};

  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputsRef = useRef([]);

  useEffect(() => {
    if (!userId) {
      navigate('/register', { replace: true });
    }
  }, [userId, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  function handleChange(index, value) {
    const clean = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (clean && index < OTP_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    inputsRef.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    const otp = digits.join('');
    if (otp.length !== OTP_LENGTH) {
      setError(`Please enter the full ${OTP_LENGTH}-digit code.`);
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { userId, otp });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setSuccess(res.data.message);
      setTimeout(() => navigate('/dashboard'), 600);
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
      if (err.response?.status === 410) {
        setDigits(Array(OTP_LENGTH).fill(''));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    setSuccess('');
    setResending(true);
    try {
      const res = await api.post('/auth/resend-otp', { userId });
      setSuccess(res.data.message);
      setDigits(Array(OTP_LENGTH).fill(''));
      setCooldown(RESEND_COOLDOWN);
      inputsRef.current[0]?.focus();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend code. Please try again shortly.');
    } finally {
      setResending(false);
    }
  }

  if (!userId) return null;

  return (
    <div className="auth-shell">
      <BrandPanel
        activeStep={1}
        title="Check your inbox"
        description="Enter the 6-digit code we emailed you to activate your account. Codes expire after a few minutes for your security."
      />
      <div className="form-panel">
        <div className="form-card">
          <h2>Verify your email</h2>
          <p className="subhead">We sent a code to <strong>{email}</strong>.</p>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="otp-inputs" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => (inputsRef.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            <div className="resend-row">
              <span>Didn't get a code?</span>
              <button
                type="button"
                className="btn-link"
                onClick={handleResend}
                disabled={resending || cooldown > 0}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? 'Sending…' : 'Resend code'}
              </button>
            </div>

            <button className="btn-primary" type="submit" disabled={loading}>
              {loading && <span className="spinner" />}
              {loading ? 'Verifying…' : 'Verify & continue'}
            </button>
          </form>

          <div className="form-footer">
            Wrong email? <Link to="/register">Start over</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
