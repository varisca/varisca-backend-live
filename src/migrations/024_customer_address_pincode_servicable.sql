-- Pincode serviceability (Delhivery) snapshot on saved addresses
ALTER TABLE customer_addresses
  ADD COLUMN IF NOT EXISTS pincode_servicable BOOLEAN NOT NULL DEFAULT FALSE;
