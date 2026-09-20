const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendOtpEmail(toEmail, fullName, otp) {
  const fromName = process.env.SMTP_FROM_NAME || 'Skovio Auth';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a2e;">
      <h2 style="margin: 0 0 8px; font-size: 20px;">Verify your email</h2>
      <p style="margin: 0 0 24px; color: #555; font-size: 14px;">Hi ${fullName || 'there'}, use the code below to verify your account. It expires in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.</p>
      <div style="background: #0f172a; color: #fff; font-size: 32px; letter-spacing: 8px; font-weight: 700; text-align: center; padding: 20px; border-radius: 10px;">
        ${otp}
      </div>
      <p style="margin: 24px 0 0; color: #888; font-size: 12px;">If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: toEmail,
    subject: 'Your verification code',
    html,
    text: `Your verification code is ${otp}. It expires in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.`,
  });
}

module.exports = { sendOtpEmail, transporter };
