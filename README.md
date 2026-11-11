# ShopMyHome

Snap a photo of a product and get a ready-to-publish Shopify listing. ShopMyHome uses Claude's vision model to identify the item and draft a title, description, tags, and suggested price — you review, tweak, and publish straight to your store.

ShopMyHome is a proof of concept that uses Claude vision to turn a photograph of a second-hand item into an editable Shopify product listing. It explores whether multimodal AI can eliminate repetitive cataloguing work for independent resellers.

> **Status:** Functional proof of concept, not a production-ready product. The capture → AI draft → merchant review → Shopify integration workflow was implemented; customer time savings, commercial viability and production security have not been independently validated.

---

## The problem

A friend running a thrift and estate-sale business was considering hiring an assistant to photograph items, write descriptions and enter products into Shopify. Each individual listing is straightforward, but the work is repeated across a large variety of one-off items.

The question was not whether AI could write a description. It was whether a **single, usable workflow** could reduce the effort between photographing a physical item and preparing a Shopify listing.

## Hypothesis and experiment

**Hypothesis:** Combining image understanding, structured data extraction, human review and Shopify publishing could materially reduce manual listing effort.

I built the core workflow in **24 hours** as a narrow experiment rather than starting with a broad inventory platform.

The prototype demonstrates technical feasibility. It does **not** yet demonstrate a measured productivity improvement or sustainable standalone product demand.

## What the prototype does

1. **Capture:** Take or upload a photograph of an item.
2. **Analyse:** Claude vision proposes a title, description, tags, category, features and price estimate.
3. **Review:** The seller edits the proposed fields before submission.
4. **Publish:** Create the product in Shopify as a draft or active product, with an option to publish to the Online Store channel.
5. **Track:** Keep a local application history of listing attempts and Shopify outcomes.

**Important:** Image-derived identification, product attributes and pricing are suggestions, not verified facts. Sellers must review condition, brand, measurements, authenticity and price.

## Product decisions and trade-offs

| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Focus on one capture-to-listing workflow | Test the operational bottleneck quickly | No bulk catalogue workflow |
| Use a multimodal foundation model | Avoid building a specialised item-recognition model | Generated details can be inaccurate |
| Require merchant review | Keep humans accountable for product accuracy and publication | Not fully automated |
| Publish through Shopify's API | Fit an existing merchant workflow rather than replace commerce infrastructure | Requires API access and careful credential security |
| Build a dedicated interface | Explore a mobile-oriented seller experience | Adds application, authentication and maintenance overhead |

## Could this be done natively instead?

Yes, increasingly. Shopify Sidekick/Shopify Magic and existing Shopify photo-to-listing apps overlap with much of this functionality. A lightweight Shopify extension or a workflow using a vision model and Shopify's API may be a better implementation for a real merchant than maintaining a separate application.

**Product lesson:** The value is not in generating product copy; it is in reducing total catalogue effort accurately and economically. A standalone product would need evidence of differentiated value — for example, handling one-off estate inventory, condition documentation, validated pricing, or batch review — before further investment.

## Implementation overview

```text
Browser / phone
      |
      v
Expo / React Native web UI + Clerk identity
      |
      v
Supabase Edge Functions (Deno)
      |-- analyze-product ------> Claude vision -> listing proposal
      |-- upload-product-image -> Supabase Storage
      `-- shopify-create-product -> Shopify Admin GraphQL API

Supabase Postgres (RLS)
      `-- products + app_settings (Clerk user scoped)
```

### Tech stack

| Layer | Technology |
| --- | --- |
| Front end | Expo, Expo Router, React Native, TypeScript |
| Identity | Clerk |
| Backend | Supabase Edge Functions (Deno) |
| Persistence | Supabase Postgres with row-level security; Supabase Storage |
| AI | Anthropic Claude vision |
| Commerce | Shopify Admin GraphQL API |

### Implementation notes

- The application uses Clerk for identity and Supabase for data and storage.
- Supabase RLS policies are intended to scope application records to a Clerk user ID.
- Listing images are uploaded through an edge function; Shopify operations are performed server-side.
- The application maintains `products` and `app_settings` tables, as documented in [`CLAUDE.md`](./CLAUDE.md).

**Security and production-readiness limitation:** At the time of this documentation review, `CLAUDE.md` describes `shopify-create-product` as decoding the JWT without verifying its signature before looking up merchant credentials through a service-role client. That path must be audited and corrected before use with real multi-merchant credentials. Authentication, authorisation, credential storage and tenancy require proper testing. Do not treat this prototype as production hardened.

## Getting started

### Prerequisites

- Node.js and npm compatible with the checked-in Expo SDK and lockfile
- Anthropic API key
- Clerk application
- Supabase project
- Shopify store with appropriate Admin API access

### Install

```bash
git clone https://github.com/AndrewLocke-pm/shopmyhome.git
cd shopmyhome
npm install
```

### Client configuration

Create a `.env` file with the appropriate public client configuration:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
```

Configure the required server-side secrets for the edge functions, including Anthropic, Supabase and Clerk JWKS settings. See [`CLAUDE.md`](./CLAUDE.md) and the deployed function configuration; the exact Clerk JWKS environment-variable casing should be checked against source before deployment.

**Never put an Anthropic key, Supabase service-role key or Shopify Admin token into an `EXPO_PUBLIC_` variable.**

### Run locally

```bash
npm run dev
```

Other repository scripts:

```bash
npm run build:web
npm run lint
npm run typecheck
```

The front end alone does not set up the three edge functions, database, storage policies or Shopify access. Review these dependencies before attempting a full deployment.

Built as proof of work by [Andrew Locke](https://www.linkedin.com/in/andrew-b-locke/) — Technical PM and founder of [Sabrulo](https://www.sabrulo.com/), an independent AI product and strategy practice.
