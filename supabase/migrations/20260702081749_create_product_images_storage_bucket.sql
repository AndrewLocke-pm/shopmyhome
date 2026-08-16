/*
# Create product-images Storage Bucket

## Summary
Creates a public Supabase Storage bucket for product photos and applies
Row Level Security so each user can only write to a folder prefixed with
their own Clerk user ID (the `sub` claim from the JWT).

## Changes

### New Storage Bucket
- `product-images` — public (objects readable without auth), max file 10 MB,
  restricted to image MIME types.

### New Storage RLS Policies (on storage.objects)
- `public_read_product_images`   – anon + authenticated can SELECT any object
  in this bucket (images are intentionally public for storefront display).
- `user_insert_product_images`   – INSERT allowed only when the first path
  segment equals the caller's Clerk `sub` claim (e.g. user_abc123/uuid.jpg).
- `user_delete_product_images`   – DELETE allowed only for the caller's own
  path prefix.

## Security Notes
1. Public read is intentional — product images are shown on storefronts.
2. Write/delete are scoped to `auth.jwt()->>'sub'`, which is the Clerk user ID
   embedded in the Bearer JWT sent by the Supabase client.  This mirrors the
   pattern already used in `requesting_clerk_id()` for table-level RLS.
3. UPDATE is deliberately omitted; clients replace images by uploading a new
   object rather than patching an existing one.
*/

-- ── Bucket ───────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
  'product-images',
  'product-images',
  true,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  10485760   -- 10 MB
)
ON CONFLICT (id) DO NOTHING;

-- ── RLS Policies ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "public_read_product_images" ON storage.objects;
CREATE POLICY "public_read_product_images" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "user_insert_product_images" ON storage.objects;
CREATE POLICY "user_insert_product_images" ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'product-images' AND
  (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
);

DROP POLICY IF EXISTS "user_delete_product_images" ON storage.objects;
CREATE POLICY "user_delete_product_images" ON storage.objects
FOR DELETE TO anon, authenticated
USING (
  bucket_id = 'product-images' AND
  (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
);
