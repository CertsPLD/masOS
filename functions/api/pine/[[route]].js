const UPSTREAM = "https://pineaccounts.pages.dev";

export async function onRequest({ request, params }) {
  const routeValue = params?.route;
  const route = (Array.isArray(routeValue) ? routeValue.join("/") : String(routeValue || ""))
    .replace(/^\/+|\/+$/g, "");

  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  const authRoutes = new Set(["auth/register", "auth/login", "auth/me", "auth/logout"]);
  const dataRoute = route === "data";
  const developerRoute = route === "developer";

  if (!authRoutes.has(route) && !dataRoute && !developerRoute) {
    return Response.json({ error: "ruta PineAccounts no permitida" }, { status: 404 });
  }

  if (dataRoute) {
    const scope = url.searchParams.get("scope");
    if (!["account", "developer", "data"].includes(scope)) {
      return Response.json({ error: "scope no permitido" }, { status: 400 });
    }
  }

  const allowedMethods = route === "auth/register" || route === "auth/login"
    ? ["POST"]
    : route === "auth/logout"
      ? ["POST"]
      : route === "auth/me" || (method === "GET" && (dataRoute || developerRoute))
        ? ["GET"]
        : dataRoute && ["POST", "PUT"].includes(method)
          ? ["POST", "PUT"]
          : developerRoute && ["POST", "PUT"].includes(method)
            ? ["POST", "PUT"]
            : [];

  if (!allowedMethods.includes(method)) {
    return Response.json({ error: "método no permitido" }, {
      status: 405,
      headers: { allow: allowedMethods.join(", "), "cache-control": "no-store" }
    });
  }

  const upstreamUrl = new URL("/api/" + route, UPSTREAM);
  upstreamUrl.search = url.search;

  const headers = new Headers();
  for (const name of ["accept", "content-type"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  // Forward only cookies namespaced by this proxy. This keeps masOS cookies
  // private while allowing PineAccounts to use whichever session-cookie name it sets.
  const pineCookies = (request.headers.get("cookie") || "")
    .split(";")
    .map(value => value.trim())
    .filter(value => value.startsWith("pine_proxy_"))
    .map(value => value.slice("pine_proxy_".length));
  if (pineCookies.length) headers.set("cookie", pineCookies.join("; "));

  const init = { method, headers, redirect: "manual" };
  if (method !== "GET" && method !== "HEAD") init.body = request.body;

  try {
    const upstream = await fetch(upstreamUrl, init);
    const responseHeaders = new Headers(upstream.headers);

    // Namespace Pine's cookies so they never collide with masOS cookies.
    const setCookies = typeof responseHeaders.getSetCookie === "function"
      ? responseHeaders.getSetCookie()
      : (responseHeaders.get("set-cookie") ? [responseHeaders.get("set-cookie")] : []);
    if (setCookies.length) {
      responseHeaders.delete("set-cookie");
      for (const original of setCookies) {
        let cookie = original
          .replace(/^([^=;]+)=/, (_, name) => "pine_proxy_" + name + "=")
          .replace(/;\s*Domain=[^;]+/ig, "")
          .replace(/;\s*Path=[^;]+/i, "; Path=/api/pine");
        if (!/;\s*Path=/i.test(cookie)) cookie += "; Path=/api/pine";
        responseHeaders.append("set-cookie", cookie);
      }
    }

    for (const name of [
      "access-control-allow-origin",
      "access-control-allow-credentials",
      "content-encoding",
      "content-length",
      "transfer-encoding",
      "connection"
    ]) responseHeaders.delete(name);

    responseHeaders.set("cache-control", "no-store");
    responseHeaders.set("vary", "Cookie");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
  } catch {
    return Response.json({ error: "no se pudo conectar con PineAccounts" }, {
      status: 502,
      headers: { "cache-control": "no-store" }
    });
  }
}
