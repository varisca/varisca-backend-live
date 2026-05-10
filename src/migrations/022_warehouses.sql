-- Migration 022: Delhivery / pickup warehouses (client warehouse mirror)
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  registered_name VARCHAR(255) DEFAULT '',
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) DEFAULT '',
  address TEXT DEFAULT '',
  city VARCHAR(255) DEFAULT '',
  pin VARCHAR(10) NOT NULL,
  country VARCHAR(100) DEFAULT 'India',
  return_address TEXT NOT NULL,
  return_pin VARCHAR(10) DEFAULT '',
  return_city VARCHAR(255) DEFAULT '',
  return_state VARCHAR(255) DEFAULT '',
  return_country VARCHAR(100) DEFAULT 'India',
  delhivery_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouses_name ON warehouses (name);
CREATE INDEX IF NOT EXISTS idx_warehouses_pin ON warehouses (pin);
