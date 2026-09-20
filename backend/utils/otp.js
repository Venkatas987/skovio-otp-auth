const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const OTP_LENGTH = parseInt(process.env.OTP_LENGTH || '6', 10);
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);

/**
 * Generates a cryptographically random numeric OTP string.
 * Never log or return this value to the client in any API response.
 */
function generateOtp(length = OTP_LENGTH) {
  const digits = '0123456789';
  let otp = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    otp += digits[bytes[i] % digits.length];
  }
  return otp;
}

async function hashOtp(otp) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(otp, salt);
}

async function compareOtp(otp, otpHash) {
  return bcrypt.compare(otp, otpHash);
}

function getExpiryDate() {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}

module.exports = {
  generateOtp,
  hashOtp,
  compareOtp,
  getExpiryDate,
  OTP_EXPIRY_MINUTES,
};
