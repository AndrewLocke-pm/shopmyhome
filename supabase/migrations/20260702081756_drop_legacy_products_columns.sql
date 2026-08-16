/*
# Drop Legacy products Columns: image_base64 and user_id

## Summary
Removes two columns from the `products` table that are no longer used after
the storage-migration and Clerk auth migration:
- `image_base64`: product photos are now stored in the `product-images` Storage
  bucket; the public URL is kept in `image_url`.  The base64 column is large,
  inflates row size, and is no longer written by the application.
- `user_id`: was a foreign key to `auth.users` (Supabase native auth).  After
  switching to Clerk, all ownership is tracked via `clerk_user_id` (text).
  The `user_id` column has been `null` for all new rows since the Clerk
  migration and is safe to remove.

## Modified Tables

### products
- DROPPED `image_base64 text` — superseded by Storage URLs in `image_url`.
- DROPPED `user_id uuid REFERENCES auth.users` — superseded by `clerk_user_id`.

## Important Notes
1. This migration is intentionally destructive for the two named columns.
   Any base64 image data previously stored is removed permanently.
2. All application reads/writes of `image_base64` must be removed from client
   code before or alongside this migration.
3. The `user_id` FK constraint is dropped implicitly with the column.
*/

ALTER TABLE products DROP COLUMN IF EXISTS image_base64;
ALTER TABLE products DROP COLUMN IF EXISTS user_id;
