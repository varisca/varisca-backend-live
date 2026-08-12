CREATE TABLE IF NOT EXISTS custom_order_product_types (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           VARCHAR(120) NOT NULL UNIQUE,
  name           VARCHAR(160) NOT NULL,
  image          TEXT NOT NULL DEFAULT '',
  base_price     NUMERIC(12,2) NOT NULL DEFAULT 499,
  original_price NUMERIC(12,2) NOT NULL DEFAULT 749,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO custom_order_product_types (slug, name, image, base_price, original_price, sort_order, is_active)
VALUES
  ('tees', 'Crew Neck', '/images/mens_white_tee_lifestyle_1770113127002.png', 499, 749, 1, TRUE),
  ('long-sleeve', 'Long Sleeve', '/images/long_sleeve_tshirt_1770113309403.png', 799, 1199, 2, TRUE),
  ('v-neck', 'V-Neck', '/images/v_neck_tshirt_1770113330903.png', 699, 999, 3, TRUE)
ON CONFLICT (slug) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_custom_order_product_types_active_sort
  ON custom_order_product_types(is_active, sort_order, name);
