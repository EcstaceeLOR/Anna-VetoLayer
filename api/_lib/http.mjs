export function applyCors(request, response) {
  const origin = String(request.headers.origin || "");
  const allowed = String(process.env.REVIEW_ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (origin && allowed.includes(origin)) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
}

export function preflight(request, response) {
  applyCors(request, response);
  if (request.method !== "OPTIONS") return false;
  response.status(204).end();
  return true;
}

export function sendError(response, error) {
  const status = Number(error?.statusCode) || 500;
  response.status(status).json({ error: status === 500 ? "internal_error" : error.message });
}

export async function readJson(request) {
  if (request.body && typeof request.body === "object") return request.body;
  let raw = "";
  for await (const chunk of request) raw += chunk;
  try { return JSON.parse(raw || "{}"); } catch { throw Object.assign(new Error("Invalid JSON body."), { statusCode: 400 }); }
}
