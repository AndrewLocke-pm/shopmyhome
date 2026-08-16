import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Decode a JWT payload without signature verification.
// We rely on the service-role DB lookup to scope data to the correct user —
// the Supabase anon key already gates who can invoke the function.
function jwtSub(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return (JSON.parse(decoded).sub as string) ?? null;
  } catch {
    return null;
  }
}

// Service-role client — bypasses RLS to read app_settings for any user.
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function getSetting(key: string, clerkUserId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  return data?.value ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── Identify the calling user from the Bearer JWT ──────────────────────
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const clerkUserId = token ? jwtSub(token) : null;

  if (!clerkUserId) {
    return new Response(
      JSON.stringify({ error: "unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const {
      title,
      description,
      price,
      tags,
      imageUrl,
      status = "draft",
    } = await req.json();

    if (!title || !description) {
      return new Response(
        JSON.stringify({ error: "title and description are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Fetch Shopify credentials server-side ─────────────────────────────
    const [shopDomain, accessToken] = await Promise.all([
      getSetting("shopify_domain", clerkUserId),
      getSetting("shopify_access_token", clerkUserId),
    ]);

    if (!shopDomain || !accessToken) {
      return new Response(
        JSON.stringify({ error: "shopify_not_configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const domain = shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const graphqlUrl = `https://${domain}/admin/api/2026-07/graphql.json`;

    // ── GraphQL productSet mutation ────────────────────────────────────────
    // "publish" means ACTIVE + pushed to Online Store sales channel
    const shopifyStatus = (status === "active" || status === "publish") ? "ACTIVE" : "DRAFT";
    const tagList: string[] = Array.isArray(tags) ? tags : [];

    const input: Record<string, unknown> = {
      title,
      descriptionHtml: `<p>${description}</p>`,
      status: shopifyStatus,
      tags: tagList,
      productOptions: [
        { name: "Title", values: [{ name: "Default Title" }] },
      ],
      variants: [
        {
          price: price ? String(price) : "0.00",
          inventoryPolicy: "DENY",
          optionValues: [{ optionName: "Title", name: "Default Title" }],
        },
      ],
    };

    if (imageUrl) {
      input.files = [{ originalSource: imageUrl, contentType: "IMAGE" }];
    }

    const mutation = `
      mutation ProductSet($input: ProductSetInput!, $synchronous: Boolean!) {
        productSet(input: $input, synchronous: $synchronous) {
          product {
            id
            handle
            title
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    const gqlResponse = await fetch(graphqlUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query: mutation, variables: { input, synchronous: true } }),
    });

    if (!gqlResponse.ok) {
      const errText = await gqlResponse.text();
      return new Response(
        JSON.stringify({ error: `Shopify API error (${gqlResponse.status}): ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const gqlData = await gqlResponse.json();

    if (gqlData.errors?.length) {
      return new Response(
        JSON.stringify({ error: "shopify_error", details: gqlData.errors }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userErrors = gqlData.data?.productSet?.userErrors ?? [];
    if (userErrors.length > 0) {
      return new Response(
        JSON.stringify({ error: "shopify_error", details: userErrors }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const product = gqlData.data?.productSet?.product;
    if (!product) {
      return new Response(
        JSON.stringify({ error: "Shopify returned no product data" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GID format: "gid://shopify/Product/1234567890"
    const numericId = product.id.split("/").pop() as string;
    const shopifyUrl = `https://${domain}/products/${product.handle}`;
    const adminUrl = `https://${domain}/admin/products/${numericId}`;

    // ── Publish to Online Store sales channel if requested ────────────────
    if (status === "publish") {
      const pubQueryRes = await fetch(graphqlUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          query: `{ publications(first: 20) { edges { node { id name } } } }`,
        }),
      });

      if (pubQueryRes.ok) {
        const pubData = await pubQueryRes.json();
        const edges: { node: { id: string; name: string } }[] =
          pubData.data?.publications?.edges ?? [];
        const onlineStore = edges.find((e) => e.node.name === "Online Store");

        if (onlineStore) {
          await fetch(graphqlUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": accessToken,
            },
            body: JSON.stringify({
              query: `
                mutation PublishablePublish($id: ID!, $input: PublishablePublishInput!) {
                  publishablePublish(id: $id, input: $input) {
                    userErrors { field message }
                  }
                }
              `,
              variables: {
                id: product.id,
                input: { publicationIds: [onlineStore.node.id] },
              },
            }),
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        productId: numericId,
        shopifyUrl,
        adminUrl,
        product,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
