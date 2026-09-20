require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');

const app = express();

// Trust the first proxy hop (required for express-rate-limit behind Railway / any reverse proxy).
// Without this, express-rate-limit throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR in production.
// Value '1' means trust exactly one proxy level — safe for Railway's infrastructure.
app.set('trust proxy', 1);

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running.' });
});

app.use('/api/auth', authRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// Central error handler (never leak stack traces or secrets)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
