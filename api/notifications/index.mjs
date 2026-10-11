import { authenticate } from "../_lib/auth.mjs";
import { getSql } from "../_lib/db.mjs";
import { preflight, sendError } from "../_lib/http.mjs";

export default async function handler(request, response) {
  if (preflight(request, response)) return;
  if (request.method !== "GET") return response.status(405).json({ error: "method_not_allowed" });
  try {
    const { userId } = await authenticate(request);
    const sql = getSql();
    const rows = await sql`
      UPDATE review_notifications SET read_at = now()
      WHERE id IN (
        SELECT id FROM review_notifications WHERE user_id = ${userId} AND read_at IS NULL ORDER BY created_at LIMIT 25 FOR UPDATE SKIP LOCKED
      ) RETURNING id, request_id, event_type, payload, created_at`;
    response.status(200).json({ notifications: rows });
  } catch (error) { sendError(response, error); }
}
