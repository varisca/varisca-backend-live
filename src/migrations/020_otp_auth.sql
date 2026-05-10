-- Migration 020: OTP auth requests + phone uniqueness hardening
CREATE TABLE IF NOT EXISTS otp_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  otp_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5),
  consumed BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_otp_requests_phone_created_at
  ON otp_requests (phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_otp_requests_phone_active
  ON otp_requests (phone, consumed, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_otp_requests_expires_at
  ON otp_requests (expires_at);

-- Keep active OTP lookup fast and enforce phone uniqueness for real values.
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_unique_non_empty
  ON customers (phone)
  WHERE phone IS NOT NULL AND btrim(phone) <> '' AND is_deleted = FALSE;

-- Optional housekeeping helper index for scheduled purge jobs.
CREATE INDEX IF NOT EXISTS idx_otp_requests_consumed_at
  ON otp_requests (consumed_at)
  WHERE consumed = TRUE;
