import { createClient } from '@supabase/supabase-js';
import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  VITE_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

/**
 * Cloudflare Pages Function to create a Supabase Auth User.
 * Runs securely on the edge with the service_role key.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // 1. Validate Environment
  if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Server configuration error: Missing Supabase credentials." }),
      { status: 500 }
    );
  }

  try {
    // 2. Parse Request Body
    const { email, password, user_metadata } = await request.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required." }),
        { status: 400 }
      );
    }

    // 3. Initialize Admin Client (service_role key = full admin privileges)
    const supabaseAdmin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    // 4. Create Auth User
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,        // auto-confirms the email
      user_metadata: user_metadata ?? {},
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    // 5. Return Success
    return new Response(JSON.stringify({ user: data.user }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
};
