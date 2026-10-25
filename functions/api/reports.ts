interface Env { reports: D1Database }

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  }
});

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get("limit") || 30);
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.trunc(rawLimit))) : 30;
    const rows = await env.reports.prepare(
      "SELECT id, category, message, status, created_at FROM reports ORDER BY created_at DESC LIMIT ?"
    ).bind(limit).all();

    return json({ ok: true, reports: rows.results });
  } catch {
    return json({
      ok: false,
      error: "reports_database_not_ready",
      hint: "Comprueba el binding D1 'reports' y aplica migrations/0001_reports.sql."
    }, 503);
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let body: { category?: unknown; message?: unknown };

  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ ok: false, error: "invalid_json_body" }, 400);
    }
    body = parsed as { category?: unknown; message?: unknown };
  } catch {
    return json({ ok: false, error: "invalid_json_body" }, 400);
  }

  const category = String(body.category ?? "general").trim().slice(0, 40) || "general";
  const message = String(body.message ?? "").trim().slice(0, 2000);
  if (message.length < 3) {
    return json({ ok: false, error: "message_too_short", hint: "Escribe al menos 3 caracteres." }, 400);
  }

  try {
    const id = crypto.randomUUID();
    await env.reports.prepare(
      "INSERT INTO reports (id, category, message, status, created_at) VALUES (?, ?, ?, 'open', datetime('now'))"
    ).bind(id, category, message).run();

    return json({ ok: true, id }, 201);
  } catch {
    return json({
      ok: false,
      error: "reports_database_not_ready",
      hint: "Comprueba el binding D1 'reports' y aplica migrations/0001_reports.sql."
    }, 503);
  }
};
