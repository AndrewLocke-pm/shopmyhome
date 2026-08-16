# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Expo dev server (web)
npm run build:web    # Export static web build to dist/
npm run lint         # Expo lint
npm run typecheck    # TypeScript check (no emit)
```

There are no automated tests in this project.

## Architecture Overview

This is an Expo Router app (SDK 54, web-only output: `single`) that lets users photograph a product, get AI-generated listing details, then push the product to their Shopify store.

### Auth: Clerk + Supabase hybrid

Clerk handles authentication (sign-in/sign-up via `@clerk/clerk-expo`). Supabase is used purely as a database and file store — **Supabase's own auth is disabled** (`persistSession: false`, `autoRefreshToken: false`).

The bridge is in `lib/supabase.ts`: a custom `clerkFetch` function wraps every Supabase request with the Clerk JWT as the `Authorization: Bearer` header. The token getter is registered at mount via `hooks/useSupabaseAuth.ts`, which calls `setClerkTokenGetter()` from inside the tabs layout. This means the Supabase client only has a valid token after the tabs mount — components in `(auth)/` must not call Supabase.

RLS policies on both tables enforce ownership using `requesting_clerk_id()`, a DB function that reads `request.jwt.claims->>'sub'` (the Clerk user ID) from the JWT Supabase receives.

### Navigation

```
app/_layout.tsx          — ClerkProvider + RouteGuard (redirects unauthenticated users)
app/(auth)/              — sign-in, sign-up (no Supabase calls here)
app/(tabs)/              — main app; useSupabaseAuth() is called in this layout
  index.tsx              — Capture tab: image picker → navigate to analyze modal
  history.tsx            — list of past products from Supabase
  settings.tsx           — Shopify domain + token stored in app_settings table
app/analyze.tsx          — full-screen modal: AI analysis → edit → publish to Shopify
```

### Core flow (`analyze.tsx`)

1. Receives `imageUri` + `imageBase64` as route params.
2. Calls `analyzeProductImage()` → `analyze-product` edge function → Claude Haiku → structured JSON.
3. User edits title, description, price, tags. Selects publish status: **Draft / Active / Publish**.
4. On submit: uploads image via `upload-product-image` edge function → Supabase Storage, then calls `publishToShopify()` → `shopify-create-product` edge function → Shopify GraphQL API.
5. Result is written to the `products` table.

**Publish vs Active distinction**: Both set `status: ACTIVE` in Shopify. `publish` additionally queries the `publications` API and calls `publishablePublish` to add the product to the Online Store sales channel.

### Edge Functions (`supabase/functions/`)

All three functions run on Deno and share the same CORS header pattern. JWT verification differs by function:

| Function | Auth method |
|---|---|
| `analyze-product` | Full Clerk JWKS verification via `npm:jose@5` + `Clerk_JWKS_URL` secret |
| `upload-product-image` | Full Clerk JWKS verification; storage path forced to `{clerkUserId}/{uuid}.ext` |
| `shopify-create-product` | JWT decoded without verification (relies on Supabase anon key gating + service-role DB scoping) |

`shopify-create-product` reads Shopify credentials from `app_settings` using the service-role client (bypasses RLS) scoped by `clerkUserId` extracted from the JWT `sub` claim.

### Database

Two tables, both with RLS enabled and scoped to `clerk_user_id`:

**`products`** — one row per Shopify listing attempt. Key columns: `clerk_user_id`, `title`, `description`, `price`, `tags` (text[]), `image_url`, `shopify_product_id`, `shopify_status` (`pending`|`published`|`failed`), `shopify_url`.

**`app_settings`** — key/value store per user. Unique index on `(clerk_user_id, key)`. Used for `shopify_domain` and `shopify_access_token`.

Storage bucket `product-images` is public-read; write is scoped to the caller's Clerk `sub` as the first path segment.

### Environment variables

Client (prefixed `EXPO_PUBLIC_`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CLERK_PUBLISHABLE_KEY`.

Edge function secrets: `ANTHROPIC_API_KEY`, `Clerk_JWKS_URL` (note mixed case), `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`.

### Key conventions

- All API calls go through `lib/api.ts`. Add new edge function wrappers there.
- `lib/supabase.ts` exports the shared `supabase` client, typed `Product` and `AppSetting` interfaces, and `getSetting`/`setSetting` helpers.
- Icons use `lucide-react-native` exclusively. No NativeWind — all styling via `StyleSheet.create`.
- Brand colour: `#0F766E` (teal). Background: `#F8FAFC`. Borders: `#E2E8F0`.
- Image compression happens client-side in `lib/api.ts` (`compressForAnalysis`) before sending to the edge function — max 800 px, 75% JPEG quality.
- Deploy edge functions with the `mcp__supabase__deploy_edge_function` MCP tool; never use the Supabase CLI.
- Schema changes go through `mcp__supabase__apply_migration`; never raw SQL outside that tool.
