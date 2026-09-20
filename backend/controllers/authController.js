const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { generateOtp, hashOtp, compareOtp, getExpiryDate, OTP_EXPIRY_MINUTES } = require('../utils/otp');
const { sendOtpEmail } = require('../utils/mailer');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RESEND_PER_WINDOW = parseInt(process.env.OTP_MAX_RESEND_PER_WINDOW || '3', 10);
const RESEND_WINDOW_MINUTES = parseInt(process.env.OTP_RESEND_WINDOW_MINUTES || '15', 10);
const RESEND_COOLDOWN_SECONDS = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10);

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function validateRegistrationInput({ fullName, email, password, confirmPassword }) {
  const errors = {};
  if (!fullName || !fullName.trim()) errors.fullName = 'Full name is required.';
  if (!email || !email.trim()) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (!password) {
    errors.password = 'Password is required.';
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  }
  if (!confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  return errors;
}

// Creates a fresh OTP for a user, stores its hash, logs the request, and emails it.
async function issueOtp(user, purpose = 'registration') {
  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const expiresAt = getExpiryDate();

  await pool.query(
    `INSERT INTO otp_verifications (user_id, otp_hash, purpose, expires_at) VALUES (?, ?, ?, ?)`,
    [user.id, otpHash, purpose, expiresAt]
  );
  await pool.query(`INSERT INTO otp_requests_log (user_id) VALUES (?)`, [user.id]);

  // OTP is only ever sent via email - never returned in the API response.
  await sendOtpEmail(user.email, user.full_name, otp);
}

async function canRequestOtp(userId) {
  const windowStart = new Date(Date.now() - RESEND_WINDOW_MINUTES * 60 * 1000);
  const [rows] = await pool.query(
    `SELECT requested_at FROM otp_requests_log WHERE user_id = ? AND requested_at >= ? ORDER BY requested_at DESC`,
    [userId, windowStart]
  );

  if (rows.length > 0) {
    const lastRequest = new Date(rows[0].requested_at);
    const secondsSinceLast = (Date.now() - lastRequest.getTime()) / 1000;
    if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
      return {
        allowed: false,
        reason: `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast)}s before requesting another code.`,
      };
    }
  }

  if (rows.length >= MAX_RESEND_PER_WINDOW) {
    return {
      allowed: false,
      reason: `Too many code requests. Please try again in ${RESEND_WINDOW_MINUTES} minutes.`,
    };
  }

  return { allowed: true };
}

// POST /api/auth/register
async function register(req, res) {
  try {
    const { fullName, email, password, confirmPassword } = req.body;
    const errors = validateRegistrationInput({ fullName, email, password, confirmPassword });
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, message: 'Please fix the errors below.', errors });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const [existing] = await pool.query('SELECT id, is_verified FROM users WHERE email = ?', [normalizedEmail]);

    if (existing.length > 0 && existing[0].is_verified) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists. Please log in.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let userId;

    if (existing.length > 0 && !existing[0].is_verified) {
      // Unverified account re-registering: update details and re-send OTP.
      userId = existing[0].id;
      await pool.query(
        'UPDATE users SET full_name = ?, password_hash = ? WHERE id = ?',
        [fullName.trim(), passwordHash, userId]
      );
    } else {
      const [result] = await pool.query(
        'INSERT INTO users (full_name, email, password_hash, is_verified) VALUES (?, ?, ?, FALSE)',
        [fullName.trim(), normalizedEmail, passwordHash]
      );
      userId = result.insertId;
    }

    const user = { id: userId, email: normalizedEmail, full_name: fullName.trim() };
    await issueOtp(user, 'registration');

    return res.status(201).json({
      success: true,
      message: 'Registration successful. A verification code has been sent to your email.',
      userId,
      email: normalizedEmail,
    });
  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
}

// POST /api/auth/verify-otp
async function verifyOtp(req, res) {
  try {
    const { userId, otp } = req.body;
    if (!userId || !otp) {
      return res.status(400).json({ success: false, message: 'User ID and OTP are required.' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }
    const user = users[0];

    if (user.is_verified) {
      return res.status(200).json({ success: true, message: 'Account already verified. Please log in.' });
    }

    const [otpRows] = await pool.query(
      `SELECT * FROM otp_verifications WHERE user_id = ? AND consumed = FALSE ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (otpRows.length === 0) {
      return res.status(400).json({ success: false, message: 'No active code found. Please request a new one.' });
    }

    const record = otpRows[0];

    if (new Date(record.expires_at) < new Date()) {
      return res.status(410).json({ success: false, message: 'This code has expired. Please request a new one.' });
    }

    if (record.attempts >= record.max_attempts) {
      return res.status(429).json({ success: false, message: 'Too many incorrect attempts. Please request a new code.' });
    }

    const isMatch = await compareOtp(String(otp).trim(), record.otp_hash);

    if (!isMatch) {
      await pool.query('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?', [record.id]);
      const remaining = record.max_attempts - (record.attempts + 1);
      return res.status(400).json({
        success: false,
        message: remaining > 0
          ? `Incorrect code. ${remaining} attempt(s) remaining.`
          : 'Incorrect code. No attempts remaining, please request a new code.',
      });
    }

    await pool.query('UPDATE otp_verifications SET consumed = TRUE WHERE id = ?', [record.id]);
    await pool.query('UPDATE users SET is_verified = TRUE WHERE id = ?', [userId]);

    const token = signToken(user);
    return res.status(200).json({
      success: true,
      message: 'Email verified successfully. You are now logged in.',
      token,
      user: { id: user.id, fullName: user.full_name, email: user.email },
    });
  } catch (err) {
    console.error('Verify OTP error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
}

// POST /api/auth/resend-otp
async function resendOtp(req, res) {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required.' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }
    const user = users[0];

    if (user.is_verified) {
      return res.status(200).json({ success: true, message: 'Account already verified. Please log in.' });
    }

    const check = await canRequestOtp(userId);
    if (!check.allowed) {
      return res.status(429).json({ success: false, message: check.reason });
    }

    // Invalidate any previous unconsumed OTPs before issuing a new one.
    await pool.query('UPDATE otp_verifications SET consumed = TRUE WHERE user_id = ? AND consumed = FALSE', [userId]);
    await issueOtp(user, 'registration');

    return res.status(200).json({ success: true, message: 'A new verification code has been sent to your email.' });
  } catch (err) {
    console.error('Resend OTP error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);

    // Generic message to avoid revealing whether the email exists.
    const invalidMsg = { success: false, message: 'Invalid email or password.' };
    if (users.length === 0) {
      return res.status(401).json(invalidMsg);
    }
    const user = users[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json(invalidMsg);
    }

    if (!user.is_verified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in.',
        userId: user.id,
        requiresVerification: true,
      });
    }

    const token = signToken(user);
    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: { id: user.id, fullName: user.full_name, email: user.email },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
}

// GET /api/auth/me
async function me(req, res) {
  try {
    const [users] = await pool.query(
      'SELECT id, full_name, email, is_verified, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }
    const user = users[0];
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        isVerified: !!user.is_verified,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    console.error('Me error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

module.exports = { register, verifyOtp, resendOtp, login, me };
