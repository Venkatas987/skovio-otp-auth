const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function sendViaBrevo(toEmail, fullName, subject, html, text, fromName, fromEmail, apiKey) {
  if (!fromEmail) {
    throw new Error('Sender email is missing. Please configure BREVO_FROM_EMAIL in environment variables.');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: fromName,
        email: fromEmail,
      },
      to: [
        {
          email: toEmail,
          name: fullName || 'User',
        },
      ],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Brevo API error (${response.status}): ${errorBody}`);
  }

  return response.json();
}

async function sendOtpEmail(toEmail, fullName, otp) {
  const brevoApiKey = (process.env.BREVO_API_KEY || '').trim();
  const fromName = (process.env.BREVO_FROM_NAME || process.env.SMTP_FROM_NAME || 'Skovio Auth').trim();
  const fromEmail = (process.env.BREVO_FROM_EMAIL || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '').trim();

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
  const text = `Your verification code is ${otp}. It expires in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.`;
  const subject = 'Your verification code';

  if (brevoApiKey) {
    console.log('[mailer] Sending OTP email via Brevo HTTPS API');
    await sendViaBrevo(toEmail, fullName, subject, html, text, fromName, fromEmail, brevoApiKey);
  } else {
    console.warn('[mailer] BREVO_API_KEY not detected, falling back to SMTP transporter');
    await getTransporter().sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: toEmail,
      subject,
      html,
      text,
    });
  }
}

module.exports = { sendOtpEmail, getTransporter };


