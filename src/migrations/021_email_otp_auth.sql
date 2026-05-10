-- Migration 021: Email OTP auth requests
CREATE TABLE IF NOT EXISTS otp_email_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  otp_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5),
  consumed BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_otp_email_requests_email_created_at
  ON otp_email_requests (email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_otp_email_requests_email_active
  ON otp_email_requests (email, consumed, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_otp_email_requests_expires_at
  ON otp_email_requests (expires_at);

CREATE INDEX IF NOT EXISTS idx_otp_email_requests_consumed_at
  ON otp_email_requests (consumed_at)
  WHERE consumed = TRUE;

