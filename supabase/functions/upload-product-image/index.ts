import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
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

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

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

  let clerkUserId: string;
  try {
    const JWKS = createRemoteJWKSet(new URL(jwksUrl));
    const { payload } = await jwtVerify(token, JWKS);
    if (!payload.sub) throw new Error("missing sub");
    clerkUserId = payload.sub;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const { base64, mimeType = "image/jpeg" } = await req.json();

    if (!base64) {
      return json({ error: "base64 is required" }, 400);
    }

    if (!ALLOWED_TYPES.has(mimeType)) {
      return json({ error: "Only image/jpeg, image/png, and image/webp are allowed" }, 400);
    }

    let bytes: Uint8Array;
    try {
      const binaryStr = atob(base64);
      if (binaryStr.length > MAX_BYTES) {
        return json({ error: "Image exceeds 10 MB limit" }, 400);
      }
      bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    } catch {
      return json({ error: "Invalid base64 data" }, 400);
    }

    const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    // Path is always derived from the verified clerkUserId — client cannot influence it.
    const path = `${clerkUserId}/${crypto.randomUUID()}.${ext}`;

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${serviceRoleKey}` } },
      }
    );

    const { error } = await admin.storage
      .from("product-images")
      .upload(path, bytes, { contentType: mimeType, upsert: false });

    if (error) return json({ error: `Upload failed: ${error.message}` }, 500);

    const { data } = admin.storage.from("product-images").getPublicUrl(path);
    return json({ imageUrl: data.publicUrl });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
