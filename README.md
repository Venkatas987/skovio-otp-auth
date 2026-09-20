# Skovio Technical Assessment — Login & Registration with Email OTP Verification

A full-stack authentication system where new accounts must verify their email
with a one-time code before they can log in.

## Project overview

- **Flow:** Register → email OTP sent → OTP verification → account activated → login → authenticated dashboard → logout
- **Frontend:** React (Vite), React Router, Axios
- **Backend:** Node.js, Express, MySQL (`mysql2`), JWT auth, bcrypt password hashing, Nodemailer for email
- **Security:** hashed passwords (bcrypt), hashed OTPs (never stored or returned in plain text), JWT sessions, per-IP and per-account rate limiting on registration, login and OTP endpoints, `.env`-based secrets (nothing committed to git)

```
skovio-otp-auth/
├── backend/          Express API + MySQL
└── frontend/         React (Vite) client
```

## Technology stack

| Layer     | Choice                                   |
|-----------|-------------------------------------------|
| Frontend  | React 18, Vite, React Router, Axios       |
| Backend   | Node.js, Express, JWT, bcryptjs, Nodemailer |
| Database  | MySQL 8                                   |
| Email     | SMTP (default example: Gmail App Password) |

## How to run the backend

1. `cd backend`
2. `npm install`
3. Copy `.env.example` to `.env` and fill in your values (see [Environment variables](#environment-variables) below).
4. Create the database and tables (see [Database setup](#database-setup)).
5. Start the API:
   - Dev (auto-reload): `npm run dev`
   - Production: `npm start`
6. The API runs on `http://localhost:5000` by default. Check `http://localhost:5000/api/health` to confirm it's up.

## How to run the frontend

1. `cd frontend`
2. `npm install`
3. Copy `.env.example` to `.env` and set `VITE_API_URL` to your backend URL (e.g. `http://localhost:5000/api`).
4. Start the dev server: `npm run dev`
5. Open `http://localhost:5173`.
6. For production: `npm run build` then deploy the generated `dist/` folder to any static host (Vercel, Netlify, etc.).

## Database setup

Run the schema file once against your MySQL server:

```bash
mysql -u root -p < backend/db.sql
```

This creates the `skovio_otp_auth` database with three tables:

- **`users`** — account details, `password_hash` (bcrypt), `is_verified` flag
- **`otp_verifications`** — bcrypt-hashed OTPs, expiry timestamps, attempt counters (never stores the raw code)
- **`otp_requests_log`** — timestamps of OTP send/resend events, used to enforce the resend rate limit

Update `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` in `backend/.env` to match your MySQL instance.

## Email / SMTP configuration

The backend uses Nodemailer with any standard SMTP provider. The `.env.example` is set up for **Gmail SMTP**:

1. Enable 2-Step Verification on the Gmail account you'll send from.
2. Generate an [App Password](https://myaccount.google.com/apppasswords).
3. Set in `backend/.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_16_character_app_password
   ```

Any other SMTP provider (SendGrid, Mailgun, Amazon SES, etc.) works the same way — just swap the host/port/credentials.

## Environment variables

### Backend (`backend/.env`)

| Variable                        | Description                                          |
|----------------------------------|-------------------------------------------------------|
| `PORT`                           | Port the API listens on                               |
| `CLIENT_URL`                     | Frontend origin, used for CORS                        |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection details      |
| `JWT_SECRET`                     | Long random string used to sign session tokens        |
| `JWT_EXPIRES_IN`                 | Token lifetime (e.g. `7d`)                             |
| `OTP_LENGTH`                     | Digits in each OTP (default `6`)                       |
| `OTP_EXPIRY_MINUTES`             | Minutes before an OTP expires (default `10`)           |
| `OTP_MAX_RESEND_PER_WINDOW`      | Max resend requests allowed per window (default `3`)   |
| `OTP_RESEND_WINDOW_MINUTES`      | Length of the resend rate-limit window (default `15`)  |
| `OTP_RESEND_COOLDOWN_SECONDS`    | Minimum gap between consecutive resend requests (default `60`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL` | Outgoing email configuration |

### Frontend (`frontend/.env`)

| Variable        | Description                          |
|------------------|---------------------------------------|
| `VITE_API_URL`  | Base URL of the backend API           |

**Never commit a real `.env` file.** Only the `.env.example` templates are tracked in git.

## How to test the application

1. Start MySQL, run `backend/db.sql`, start the backend, then the frontend.
2. Go to `/register`, fill in the form with a real email address you can access, and submit.
3. Check that email for the 6-digit code; you'll be redirected to `/verify-otp` automatically.
4. Try an incorrect code first to see the error/attempt-remaining message, then enter the correct one.
5. On success you're logged in and redirected to `/dashboard`.
6. Log out, then go to `/login` and sign back in with the same credentials.
7. To test edge cases:
   - Wait past `OTP_EXPIRY_MINUTES` before entering the code → expect an "expired" message and a working **Resend code** button.
   - Click **Resend code** repeatedly → expect the cooldown timer and, after `OTP_MAX_RESEND_PER_WINDOW` requests, a rate-limit message.
   - Try logging in before verifying → expect "please verify your email" and a redirect back to the OTP screen.
   - Try logging in with a wrong password → expect a generic "invalid email or password" message (this wording is intentional so it doesn't reveal whether the email exists).

## API endpoints (reference)

| Method | Endpoint                  | Description                              |
|--------|----------------------------|-------------------------------------------|
| POST   | `/api/auth/register`       | Create account, send OTP                  |
| POST   | `/api/auth/verify-otp`     | Verify OTP, activate account, returns JWT |
| POST   | `/api/auth/resend-otp`     | Resend a new OTP (rate-limited)           |
| POST   | `/api/auth/login`          | Log in with email + password              |
| GET    | `/api/auth/me`             | Get current user (requires `Authorization: Bearer <token>`) |

## Security notes

- Passwords are hashed with bcrypt (cost factor 10) before storage — never stored or logged in plain text.
- OTPs are generated with `crypto.randomBytes`, hashed with bcrypt before being stored, and are never included in any API response, log line, or source file — they only ever leave the server inside the email itself.
- Failed OTP attempts are capped per code; exceeding the limit requires requesting a new code.
- Resending OTPs is limited by both a cooldown and a rolling-window cap, tracked per account in `otp_requests_log`.
- Login and registration are additionally rate-limited per IP address via `express-rate-limit`.
- All secrets (DB credentials, SMTP credentials, JWT secret) are read from environment variables and are gitignored.
