# ShopMyHome

Snap a photo of a product and get a ready-to-publish Shopify listing. ShopMyHome uses Claude's vision model to identify the item and draft a title, description, tags, and suggested price — you review, tweak, and publish straight to your store.

---

## Why I built this

A friend runs a thrifting and estate-sale business and was about to hire an assistant whose whole job would be: photograph items, write descriptions, and load them onto Shopify. Slow, repetitive, and exactly the kind of thing vision models are now good at.

So I said hold my beer — and built ShopMyHome in **24 hours** to do that job end to end: point your phone at an item, and it comes back as a drafted listing you can publish in a tap.

It's a deliberately tight build — one real workflow, done properly — and a demonstration of going from a real person's real problem to a working, deployable app fast, with the fiddly production concerns (auth, per-user isolation, third-party publishing) actually handled rather than hand-waved.

---

## What it does

| Step | Action |
|---|---|
| 📸 **Capture** | Take or upload a product photo |
| 🧠 **Analyse** | Claude vision drafts title, description, tags, category, key features, and estimated price |
| ✏️ **Review** | Edit any field before publishing |
| 🚀 **Publish** | Push to Shopify as Draft, Active, or live on your Online Store |
| 📋 **Track** | Every listing saved to history with Shopify status (pending / published / failed) |

---

## How it's built

```
Browser / Phone
      │
      ▼
Expo (React Native / web)
      │  Clerk JWT on every request
      ▼
Supabase Edge Functions (Deno)
      ├──▶ analyze-product        → Claude Vision API       → structured listing JSON
      ├──▶ upload-product-image   → Supabase Storage        → image URL (per-user path)
      └──▶ shopify-create-product → Shopify Admin GraphQL   → product draft / publish

Supabase Postgres (RLS)
      └── listings + shopify_connections (both scoped to clerk_user_id)
```

**Notable engineering decisions:**

- **Clerk + Supabase hybrid auth** — Clerk handles identity; Supabase auth is disabled and used purely as database + storage. Every request carries the Clerk JWT as a Bearer token, and row-level security enforces per-user ownership via a `requesting_clerk_id()` DB function that reads the Clerk `sub` from the JWT.
- **Per-user isolation** — both tables are RLS-scoped to `clerk_user_id`; storage write paths are forced to `{clerkUserId}/…` so users can't touch each other's data.
- **Secrets stay server-side** — Anthropic key, Supabase service-role key, and each user's Shopify token live as edge-function secrets or per-user rows, never in the client bundle.
- **Three edge functions** — `analyze-product`, `upload-product-image`, `shopify-create-product` — each verifies the JWT independently.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Expo (React Native, web output), Expo Router, TypeScript |
| Auth | Clerk (`@clerk/clerk-expo`) |
| Database & Storage | Supabase (Postgres + RLS, Storage) |
| Backend | Supabase Edge Functions (Deno) |
| AI | Anthropic Claude (vision) |
| E-commerce | Shopify Admin GraphQL API |

---

## Getting started

### Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 18+ | |
| Expo CLI | `npm install -g expo-cli` |
| [Anthropic](https://console.anthropic.com) account | Console → API Keys |
| [Clerk](https://clerk.com) application | Dashboard → API Keys |
| [Supabase](https://supabase.com) project | Project → Settings → API |
| [Shopify](https://shopify.dev/docs/apps/build/custom-apps) custom app | Store admin → Apps → Develop apps |

### 1. Clone and install

```bash
git clone https://github.com/your-username/shopmyhome.git
cd shopmyhome
npm install
```

### 2. Client environment variables

Create `.env` at the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### 3. Edge function secrets

In Supabase → Settings → Edge Functions, add:

```
ANTHROPIC_API_KEY
CLERK_JWKS_URL          # https://your-clerk-domain/.well-known/jwks.json
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

### 4. Run

```bash
npm run dev          # Expo dev server (web)
npm run build:web    # static web build → dist/
```

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture guide, including edge function deployment and Shopify custom app setup.

---

## Project status

This is a **proof-of-concept** — the core workflow (capture → analyse → publish) is fully functional. Deliberately out of scope: multi-image listings, bulk upload, inventory management, pricing intelligence.

---

Built as proof of work by [Andrew Locke](https://www.linkedin.com/in/andrew-b-locke/) — Technical PM and founder of [Sabrulo](https://www.sabrulo.com/), an independent AI product and strategy practice.
