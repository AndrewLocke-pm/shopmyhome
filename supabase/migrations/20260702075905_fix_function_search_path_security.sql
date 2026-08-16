
-- Fix mutable search_path security warnings by pinning search_path on both functions.

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.requesting_clerk_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT nullif(
    current_setting('request.jwt.claims', true)::jsonb->>'sub',
    ''
  )
$$;
