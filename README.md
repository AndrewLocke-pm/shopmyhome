# ShopMyHome

Snap a photo of a product and get a ready-to-publish Shopify listing. ShopMyHome uses Claude's vision model to identify the item and draft a title, description, tags, and suggested price — you review, tweak, and publish straight to your store.

---

## Why I built this

A friend runs a thrifting and estate-sale business and was about to hire an assistant whose whole job would be: photograph items, write descriptions, and load them onto Shopify. Slow, repetitive, and exactly the kind of thing vision models are now good at.

So I said hold my beer — and built ShopMyHome in **24 hours** to do that job end to end: point your phone at an item, and it comes back as a drafted listing you can publish in a tap.

It's a deliberately tight build — one real workflow, done properly — and a good demonstration of going from a real person's real problem to a working, deployable app fast, with the fiddly production concerns (auth, per-user isolation, third-party publishing) actually handled rather than hand-waved.

---

## What it does

1. **Capture** — take or upload a product photo
2. **Analyse** — Claude vision identifies the product and drafts title, description, tags, category, key features, and an estimated price
3. **Review** — edit any field before publishing
4. **Publish** — pushes to Shopify as Draft, Active, or live on your Online Store sales channel
5. **Track** — every listing is saved to history with its Shopify status (pending / published / failed)

---

## How it's built

A mobile-first Expo (React Native, web output) app with a Supabase backend and a Clerk-secured auth model.

```
Expo (React Native / web)  ──▶  Supabase Edge Functions (Deno)  ──▶  Claude vision  (product analysis)
        │                                    │
   Clerk auth (JWT)                          ├─▶  Supabase Storage   (product images)
        │                                    └─▶  Shopify Admin GraphQL API  (publish)
   Supabase (Postgres + RLS)
```

**Notable engineering decisions:**

- **Clerk + Supabase hybrid auth** — Clerk handles identity; Supabase auth is disabled and used purely as database + storage. Every Supabase request carries the Clerk JWT as a Bearer token, and row-level security enforces per-user ownership via a `requesting_clerk_id()` DB function that reads the Clerk `sub` from the JWT.
- **Per-user isolation** — both tables are RLS-scoped to `clerk_user_id`; storage write paths are forced to `{clerkUserId}/…` so users can't touch each other's images.
- **Secrets stay server-side** — Anthropic key, Supabase service-role key, and each user's Shopify token live as edge-function secrets or per-user rows, never in the client bundle.
- **Three edge functions** — `analyze-product` (Claude vision), `upload-product-image` (Storage), `shopify-create-product` (Shopify GraphQL) — each with its own JWT-verification strategy.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Expo (React Native, web output), Expo Router, TypeScript |
| Auth | Clerk (`@clerk/clerk-expo`) |
| Database & Storage | Supabase (Postgres, RLS, Storage) |
| Backend | Supabase Edge Functions (Deno) |
| AI | Anthropic Claude (vision) |
| E-commerce | Shopify Admin GraphQL API |

---

## Run Locally

```bash
npm install
npm run dev          # Expo dev server (web)
npm run build:web    # static web build → dist/
```

Client env vars (`.env`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
Edge-function secrets (set in Supabase): `ANTHROPIC_API_KEY`, `Clerk_JWKS_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`.

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture guide.

---

Built as proof of work by [Andrew Locke](https://www.linkedin.com/in/andrew-b-locke/) — Technical PM and founder of [Sabrulo](https://www.sabrulo.com/), an independent AI product & strategy practice.
