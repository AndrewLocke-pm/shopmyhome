# ShopMyHome — AI-Powered Shopify Product Lister

Snap a photo of any product and let AI write the listing for you. ShopMyHome uses Claude's vision model to identify products, generate titles, descriptions, tags, and suggested pricing, then publishes directly to your Shopify store.

## Features

- **Photo-to-listing** — Take or upload a product photo and get AI-generated listing details instantly
- **AI analysis** — Claude Haiku identifies the product, writes a compelling description, suggests tags, category, key features, and an estimated price
- **Editable drafts** — Review and tweak every field before publishing: title, description, price, tags, AI-identified features
- **Shopify publishing** — Push products to Shopify as Draft, Active, or published to your Online Store sales channel
- **History** — Every listing attempt is saved, with Shopify status tracking (pending / published / failed)
- **Settings** — Securely store your Shopify store domain and access token per account

## How it works

1. **Capture** — Pick or take a photo on the Capture tab
2. **Analyze** — The image is sent to a Supabase Edge Function that calls Anthropic's Claude API for product recognition
3. **Review** — Edit the AI-generated title, description, price, and tags
4. **Publish** — The image is uploaded to Supabase Storage, then the product is created in Shopify via the Admin GraphQL API
5. **Track** — The result is saved to your history with links back to Shopify

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Expo (React Native, web output), Expo Router, TypeScript |
| Authentication | Clerk (`@clerk/clerk-expo`) |
| Database & Storage | Supabase (Postgres, RLS, Storage bucket) |
| Edge functions | Supabase Functions (Deno) |
| AI | Anthropic Claude API (vision) |
| E-commerce | Shopify Admin GraphQL API |

## Architecture

### Auth: Clerk + Supabase hybrid

Clerk handles all authentication. Supabase auth is disabled — it's used purely as a database and file store. Every Supabase request from the client carries the Clerk JWT as a Bearer token. Row-level security policies enforce per-user ownership using a `requesting_clerk_id()` DB function that reads the Clerk user ID from the JWT.

### Edge functions

All three functions run on Deno and share CORS headers.

| Function | Purpose | Auth |
|---|---|---|
| `analyze-product` | Sends image to Claude, returns structured JSON | Full Clerk JWKS verification |
| `upload-product-image` | Uploads image to Supabase Storage, returns public URL | Full Clerk JWKS verification |
| `shopify-create-product` | Creates product in Shopify via GraphQL | JWT-decoded user ID + service-role DB scoping |

### Database

Two tables, both RLS-enabled and scoped to `clerk_user_id`:

- **`products`** — one row per listing attempt (title, description, price, tags, image URL, Shopify product ID, status, Shopify URL)
- **`app_settings`** — per-user key/value store for Shopify credentials

A public-read Storage bucket (`product-images`) holds uploaded product photos, with write paths scoped to each user's Clerk ID.

## Getting started

### Prerequisites

- Node.js 18+
- An Expo account (for the build tooling)
- A Clerk account and app (for authentication)
- A Supabase project (for database, storage, and edge functions)
- An Anthropic API key (for Claude vision analysis)
- A Shopify store with Admin API access (for publishing)

### Install

```bash
npm install
```

### Environment variables

Create a `.env` file in the project root:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
```

Configure these as edge function secrets in Supabase:

- `ANTHROPIC_API_KEY` — Anthropic API key
- `Clerk_JWKS_URL` — Clerk JWKS URL (note: mixed case)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key
- `SUPABASE_URL` — Supabase project URL

### Run the dev server

```bash
npm run dev
```

### Build for web

```bash
npm run build:web
```

Output is written to `dist/`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Expo dev server |
| `npm run build:web` | Export a static web build to `dist/` |
| `npm run lint` | Run Expo lint |
| `npm run typecheck` | TypeScript check (no emit) |

## Project structure

```
app/
├── _layout.tsx              — Clerk provider + route guard
├── +not-found.tsx           — 404 screen
├── analyze.tsx              — AI analysis → edit → publish modal
├── (auth)/
│   ├── _layout.tsx          — Auth layout
│   ├── sign-in.tsx          — Sign in screen
│   └── sign-up.tsx          — Sign up screen
└── (tabs)/
    ├── _layout.tsx          — Tab bar + Supabase auth bridge
    ├── index.tsx            — Capture tab (photo picker)
    ├── history.tsx          — Past listings from Supabase
    └── settings.tsx         — Shopify credential settings

lib/
├── api.ts                   — Edge function wrappers + image compression
└── supabase.ts              — Supabase client + Clerk token bridge

hooks/
├── useFrameworkReady.ts     — Expo framework init
└── useSupabaseAuth.ts       — Registers Clerk token getter with Supabase

supabase/
├── functions/
│   ├── analyze-product/     — Claude vision API call
│   ├── upload-product-image/ — Storage upload
│   └── shopify-create-product/ — Shopify GraphQL mutation
└── migrations/              — SQL migrations (tables, RLS, storage bucket)
```

## User flow

1. Sign in or create an account
2. Go to **Settings** and enter your Shopify store domain and access token
3. On the **Capture** tab, take or upload a product photo
4. AI analyzes the image and fills in product details
5. Edit any field as needed, choose Draft / Active / Publish
6. Tap **Publish to Shopify**
7. View your listing history on the **History** tab

## Notes

- Images are compressed client-side (max 800px, 75% JPEG quality) before analysis to reduce payload size
- The Shopify `publish` option sets the product to ACTIVE and pushes it to the Online Store sales channel; `active` sets it to ACTIVE without publishing to a channel; `draft` saves it as a Shopify draft
- All database access is protected by row-level security scoped to each user's Clerk ID
