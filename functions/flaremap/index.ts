
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } =
      await supabase.auth.getUser(token);

    if (authError || !user) {
      return Response.json(
        { error: "Invalid user session" },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await req.json();

    if (
      body.action !== "subscribe" ||
      !body.subscription ||
      typeof body.subscription.endpoint !== "string"
    ) {
      return Response.json(
        { error: "Invalid subscription request" },
        { status: 400, headers: corsHeaders }
      );
    }

    const endpoint = body.subscription.endpoint;

    if (!endpoint.startsWith("https://")) {
      return Response.json(
        { error: "Invalid subscription endpoint" },
        { status: 400, headers: corsHeaders }
      );
    }

    const { error: insertError } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint,
          subscription: body.subscription,
        },
        { onConflict: "endpoint" }
      );

    if (insertError) {
      throw insertError;
    }

    return Response.json(
      { success: true, message: "Subscription saved" },
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error("FlareMap function error:", error);

    return Response.json(
      { error: "Unable to process subscription" },
      { status: 500, headers: corsHeaders }
    );
  }
});
