const CATALOG_URL = "https://apps-ecosos.base44.app/functions/getAllApps";

export async function onRequest({ request }) {
  if (request.method !== "GET") {
    return Response.json({ error: "método no permitido" }, {
      status: 405,
      headers: { allow: "GET", "cache-control": "no-store" }
    });
  }

  try {
    const upstream = await fetch(CATALOG_URL, {
      method: "GET",
      headers: { accept: "application/json" },
      redirect: "follow"
    });

    const headers = new Headers(upstream.headers);
    for (const name of [
      "access-control-allow-origin",
      "access-control-allow-credentials",
      "content-encoding",
      "content-length",
      "transfer-encoding",
      "connection"
    ]) headers.delete(name);

    headers.set("cache-control", "no-store");
    headers.set("content-type", headers.get("content-type") || "application/json; charset=utf-8");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers
    });
  } catch {
    return Response.json({ error: "catalog_unavailable", message: "No se pudo conectar con el catálogo de aplicaciones" }, {
      status: 502,
      headers: { "cache-control": "no-store" }
    });
  }
}
