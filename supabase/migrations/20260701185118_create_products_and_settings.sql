
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  image_base64 text,
  title text NOT NULL,
  description text NOT NULL,
  price numeric(10, 2),
  tags text[],
  shopify_product_id text,
  shopify_status text CHECK (shopify_status IN ('pending', 'published', 'failed')),
  shopify_url text,
  ai_raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_products" ON products FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_own_products" ON products FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_own_products" ON products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_own_products" ON products FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_app_settings" ON app_settings FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_app_settings" ON app_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_app_settings" ON app_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_app_settings" ON app_settings FOR DELETE
  TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
