
import { createClient } from '@supabase/supabase-js';

/**
 * Cloudflare Pages Function to create a Supabase Auth User.
 * This runs securely on the server, accessing the SUPABASE_SERVICE_ROLE_KEY
 * which should be set in the Cloudflare Pages project settings.
 */
export const onRequestPost = async (context) => {
  const { request, env } = context;

  // 1. Validate Environment
  if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Server configuration error: Missing Supabase credentials." }), { status: 500 });
  }

  try {
    // 2. Parse Request Body
    const { email, password, user_metadata } = await request.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required." }), { status: 400 });
    }

    // 3. Initialize Admin Client
    const supabaseAdmin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    // 4. Create Auth User
    // Using admin.createUser allows creating users without sending confirmation emails immediately if we set email_confirm: true
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for now to allow immediate login
      user_metadata
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    // 5. Return Success
    return new Response(JSON.stringify({ user: data.user }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}
