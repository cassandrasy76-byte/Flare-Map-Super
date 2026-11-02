import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestBody = {
  action?: string;
  email?: string;
  password?: string;
  bootstrapKey?: string;
  subscription?: {
    endpoint?: string;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
    [key: string]: unknown;
  };
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function secretMatches(provided: string, expected: string) {
  const providedBytes = new TextEncoder().encode(provided);
  const expectedBytes = new TextEncoder().encode(expected);
  if (providedBytes.length !== expectedBytes.length) return false;

  let difference = 0;
  for (let index = 0; index < providedBytes.length; index += 1) {
    difference |= providedBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

async function registerAdmin(
  body: RequestBody,
  adminClient: ReturnType<typeof createClient>,
) {
  const expectedKey = Deno.env.get("FLAREMAP_ADMIN_BOOTSTRAP_KEY");
  const configuredEmail = Deno.env.get("FLAREMAP_ADMIN_EMAIL")?.trim().toLowerCase();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!expectedKey || !configuredEmail) {
    return respond(503, { error: "Admin registration is not configured." });
  }
  if (!body.bootstrapKey || !secretMatches(body.bootstrapKey, expectedKey)) {
    return respond(401, { error: "Invalid registration credentials." });
  }
  if (!email || email !== configuredEmail) {
    return respond(403, { error: "This email is not authorized for admin registration." });
  }
  if (!password || password.length < 12) {
    return respond(400, { error: "Password must be at least 12 characters." });
  }

  const { data: existingAdmin, error: lookupError } = await adminClient
    .from("admin_users")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    return respond(500, { error: "Could not verify admin registration status." });
  }
  if (existingAdmin) {
    return respond(409, { error: "An admin account has already been registered." });
  }

  const { data: created, error: createError } = await adminClient.auth.admin
    .createUser({ email, password, email_confirm: true });

  if (createError || !created.user) {
    return respond(409, { error: "Could not create the admin account." });
  }

  const { error: insertError } = await adminClient.from("admin_users").insert({
    id: created.user.id,
    email,
  });

  if (insertError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return respond(500, { error: "Could not register the admin account." });
  }

  return respond(201, { id: created.user.id, email });
}

async function saveSubscription(
  request: Request,
  body: RequestBody,
  adminClient: ReturnType<typeof createClient>,
) {
  const authorization = request.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return respond(401, { error: "Authentication is required." });

  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authData.user) {
    return respond(401, { error: "Authentication is invalid." });
  }

  const subscription = body.subscription;
  const endpoint = subscription?.endpoint;
  if (typeof endpoint !== "string" || typeof subscription !== "object") {
    return respond(400, { error: "A valid push subscription is required." });
  }

  try {
    if (new URL(endpoint).protocol !== "https:") {
      return respond(400, { error: "The push endpoint must use HTTPS." });
    }
  } catch {
    return respond(400, { error: "The push endpoint is invalid." });
  }

  const { data: existing, error: lookupError } = await adminClient
    .from("push_subscriptions")
    .select("user_id")
    .eq("endpoint", endpoint)
    .maybeSingle();

  if (lookupError) {
    return respond(500, { error: "Could not save the push subscription." });
  }
  if (existing && existing.user_id !== authData.user.id) {
    return respond(409, { error: "This push endpoint is already registered." });
  }

  const saveQuery = existing
    ? adminClient.from("push_subscriptions")
      .update({ subscription })
      .eq("endpoint", endpoint)
      .eq("user_id", authData.user.id)
    : adminClient.from("push_subscriptions").insert({
      user_id: authData.user.id,
      endpoint,
      subscription,
    });

  const { error: saveError } = await saveQuery;
  if (saveError) return respond(500, { error: "Could not save the push subscription." });

  return respond(200, { success: true });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return respond(405, { error: "Method not allowed." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return respond(500, { error: "The function is not configured." });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return respond(400, { error: "Request body must be valid JSON." });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    if (body.action === "register-admin") {
      return await registerAdmin(body, adminClient);
    }
    if (body.action === "subscribe") {
      return await saveSubscription(request, body, adminClient);
    }
    return respond(400, { error: "Unsupported action." });
  } catch {
    return respond(500, { error: "The request could not be completed." });
  }
});
