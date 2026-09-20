const rateLimit = require('express-rate-limit');

// General protection against brute-force login attempts (per IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

// General protection for registration endpoint (per IP)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many registration attempts. Please try again later.' },
});

// Protects the resend-otp / verify-otp endpoints from abuse at the IP level.
// Per-account limiting is additionally enforced in the controller using the
// otp_requests_log table (see controllers/authController.js).
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many OTP requests. Please try again later.' },
});

module.exports = { loginLimiter, registerLimiter, otpLimiter };
