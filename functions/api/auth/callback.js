export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return errorPage("Missing OAuth code.");
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return errorPage("Server misconfigured: missing OAuth credentials.");
  }

  let data;
  try {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    data = await res.json();
  } catch {
    return errorPage("Failed to reach GitHub.");
  }

  if (data.error || !data.access_token) {
    return errorPage(`GitHub OAuth error: ${data.error_description ?? data.error}`);
  }

  const token = JSON.stringify(data.access_token);
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Authorizing…</title></head>
<body>
<script>
(function () {
  var token = ${token};
  var provider = "github";
  function receive(e) {
    window.opener.postMessage(
      "authorization:" + provider + ":success:" + JSON.stringify({ token: token, provider: provider }),
      e.origin
    );
  }
  window.addEventListener("message", receive, false);
  window.opener.postMessage("authorizing:" + provider, "*");
})();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function errorPage(msg) {
  return new Response(
    `<!DOCTYPE html><html><body><p style="font-family:monospace;color:red">${msg}</p></body></html>`,
    { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
