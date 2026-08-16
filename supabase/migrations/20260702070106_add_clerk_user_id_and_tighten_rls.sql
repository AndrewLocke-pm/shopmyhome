
-- Helper: extract the Clerk user ID (sub claim) from the JWT
CREATE OR REPLACE FUNCTION requesting_clerk_id()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT nullif(
    current_setting('request.jwt.claims', true)::jsonb->>'sub',
    ''
  )
$$;

-- ── products ─────────────────────────────────────────────────────────────────

ALTER TABLE products ADD COLUMN IF NOT EXISTS clerk_user_id text;

-- Drop old open policies
DROP POLICY IF EXISTS "select_own_products" ON products;
DROP POLICY IF EXISTS "insert_own_products" ON products;
DROP POLICY IF EXISTS "update_own_products" ON products;
DROP POLICY IF EXISTS "delete_own_products" ON products;

CREATE POLICY "select_own_products" ON products FOR SELECT
  TO anon, authenticated USING (clerk_user_id = requesting_clerk_id());

CREATE POLICY "insert_own_products" ON products FOR INSERT
  TO anon, authenticated WITH CHECK (clerk_user_id = requesting_clerk_id());

CREATE POLICY "update_own_products" ON products FOR UPDATE
  TO anon, authenticated
  USING (clerk_user_id = requesting_clerk_id())
  WITH CHECK (clerk_user_id = requesting_clerk_id());

CREATE POLICY "delete_own_products" ON products FOR DELETE
  TO anon, authenticated USING (clerk_user_id = requesting_clerk_id());

-- ── app_settings ─────────────────────────────────────────────────────────────

ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_key_key;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS clerk_user_id text;

-- Make key unique per user instead of globally
DROP INDEX IF EXISTS app_settings_key_idx;
CREATE UNIQUE INDEX IF NOT EXISTS app_settings_clerk_user_key
  ON app_settings (clerk_user_id, key);

-- Drop old open policies
DROP POLICY IF EXISTS "select_app_settings" ON app_settings;
DROP POLICY IF EXISTS "insert_app_settings" ON app_settings;
DROP POLICY IF EXISTS "update_app_settings" ON app_settings;
DROP POLICY IF EXISTS "delete_app_settings" ON app_settings;

CREATE POLICY "select_app_settings" ON app_settings FOR SELECT
  TO anon, authenticated USING (clerk_user_id = requesting_clerk_id());

CREATE POLICY "insert_app_settings" ON app_settings FOR INSERT
  TO anon, authenticated WITH CHECK (clerk_user_id = requesting_clerk_id());

CREATE POLICY "update_app_settings" ON app_settings FOR UPDATE
  TO anon, authenticated
  USING (clerk_user_id = requesting_clerk_id())
  WITH CHECK (clerk_user_id = requesting_clerk_id());

CREATE POLICY "delete_app_settings" ON app_settings FOR DELETE
  TO anon, authenticated USING (clerk_user_id = requesting_clerk_id());
