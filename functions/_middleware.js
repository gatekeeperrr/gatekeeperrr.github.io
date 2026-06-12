export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (!url.pathname.startsWith("/admin")) {
    return next();
  }

  const password = env.ADMIN_PASSWORD;
  if (!password) {
    return new Response("Server misconfigured: missing ADMIN_PASSWORD", { status: 500 });
  }

  const auth = request.headers.get("Authorization");
  if (auth && auth.startsWith("Basic ")) {
    const decoded = atob(auth.slice(6));
    const colonIndex = decoded.indexOf(":");
    const inputPassword = colonIndex !== -1 ? decoded.slice(colonIndex + 1) : decoded;

    if (timingSafeEqual(inputPassword, password)) {
      return next();
    }
  }

  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="pr1meM Admin", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
