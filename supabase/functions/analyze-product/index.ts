import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ok = (body: unknown) => json(body, 200);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── Clerk JWT verification ──────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return json({ error: "unauthorized" }, 401);
  }

  const jwksUrl = Deno.env.get("Clerk_JWKS_URL");
  if (!jwksUrl) {
    return json({ error: "Clerk_JWKS_URL not configured" }, 500);
  }

  try {
    const JWKS = createRemoteJWKSet(new URL(jwksUrl));
    const { payload } = await jwtVerify(token, JWKS);
    if (!payload.sub) throw new Error("missing sub");
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const { imageBase64, imageUrl, mimeType = "image/jpeg" } = await req.json();

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) return ok({ error: "ANTHROPIC_API_KEY not configured" });

    let imageContent: Record<string, unknown>;
    if (imageBase64) {
      imageContent = {
        type: "image",
        source: { type: "base64", media_type: mimeType, data: imageBase64 },
      };
    } else if (imageUrl) {
      imageContent = {
        type: "image",
        source: { type: "url", url: imageUrl },
      };
    } else {
      return ok({ error: "imageBase64 or imageUrl required" });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              imageContent,
              {
                type: "text",
                text: `Analyze this product image and respond with a JSON object (no markdown, just raw JSON) with these fields:
{
  "title": "Short product title (max 80 chars)",
  "description": "Compelling e-commerce product description (2-3 sentences, highlight key features and benefits)",
  "category": "Product category",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "suggestedPrice": 29.99,
  "condition": "new | used | refurbished",
  "keyFeatures": ["feature1", "feature2", "feature3"]
}

Be specific and accurate. If you cannot identify the product clearly, still provide your best assessment based on what you can see.`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return ok({ error: `Anthropic API error: ${err}` });
    }

    const data = await response.json();
    const rawText = data.content[0].text;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return ok({ error: "Failed to parse AI response", raw: rawText });
      }
    }

    return ok({ result: parsed });
  } catch (err) {
    return ok({ error: String(err) });
  }
});
