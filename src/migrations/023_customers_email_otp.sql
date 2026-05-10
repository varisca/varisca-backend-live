-- ═══════════════════════════════════════════════════════════════════
-- Migration 023: Store email OTP state on customers; retire otp_email_requests
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS email_otp_hash TEXT,
  ADD COLUMN IF NOT EXISTS email_otp_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_otp_attempts INTEGER NOT NULL DEFAULT 0
    CHECK (email_otp_attempts >= 0 AND email_otp_attempts <= 5),
  ADD COLUMN IF NOT EXISTS email_otp_last_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_otp_hour_window_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_otp_sends_this_hour INTEGER NOT NULL DEFAULT 0
    CHECK (email_otp_sends_this_hour >= 0),
  ADD COLUMN IF NOT EXISTS email_otp_pending_is_new_customer BOOLEAN NOT NULL DEFAULT FALSE;

DROP TABLE IF EXISTS otp_email_requests;
