const express = require('express');
const router = express.Router();
const { register, verifyOtp, resendOtp, login, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { loginLimiter, registerLimiter, otpLimiter } = require('../middleware/rateLimiter');

router.post('/register', registerLimiter, register);
router.post('/verify-otp', otpLimiter, verifyOtp);
router.post('/resend-otp', otpLimiter, resendOtp);
router.post('/login', loginLimiter, login);
router.get('/me', requireAuth, me);

module.exports = router;
