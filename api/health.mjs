import { getSql } from "./_lib/db.mjs";
import { preflight } from "./_lib/http.mjs";

const requiredConfiguration = [
  "DATABASE_URL",
  "CLERK_SECRET_KEY",
  "REVIEW_ALLOWED_ORIGINS",
  "REVIEW_AUTHORIZED_PARTIES"
];

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (preflight(request, response)) return;
  if (request.method !== "GET") return response.status(405).json({ error: "method_not_allowed" });

  const missing = requiredConfiguration.filter((name) => !process.env[name]);
  if (missing.length) return response.status(503).json({ status: "misconfigured", missing });

  try {
    const sql = getSql();
    await sql`SELECT 1 AS ready`;
    return response.status(200).json({ status: "ready" });
  } catch {
    return response.status(503).json({ status: "degraded" });
  }
}
