-- Skovio OTP Auth - Database Schema
-- Run this once against your MySQL server before starting the backend.

CREATE DATABASE IF NOT EXISTS skovio_otp_auth
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE skovio_otp_auth;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- OTP verification records
-- OTPs are stored as a bcrypt hash only, never in plain text.
CREATE TABLE IF NOT EXISTS otp_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  purpose VARCHAR(50) NOT NULL DEFAULT 'registration',
  expires_at TIMESTAMP NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  consumed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Tracks OTP send/resend events for rate limiting per user
CREATE TABLE IF NOT EXISTS otp_requests_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_otp_user ON otp_verifications(user_id);
CREATE INDEX idx_otp_requests_user_time ON otp_requests_log(user_id, requested_at);
