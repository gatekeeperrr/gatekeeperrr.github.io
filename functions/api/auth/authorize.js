export async function onRequestGet({ request, env }) {
  const clientId = env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return new Response("Server misconfigured: missing GITHUB_CLIENT_ID", { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const params = new URLSearchParams({
    client_id: clientId,
    scope: "repo,user",
    redirect_uri: `${origin}/api/auth/callback`,
  });

  return Response.redirect(
    `https://github.com/login/oauth/authorize?${params}`,
    302
  );
}
