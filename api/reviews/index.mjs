import { authenticate } from "../_lib/auth.mjs";
import { getSql } from "../_lib/db.mjs";
import { preflight, readJson, sendError } from "../_lib/http.mjs";

export default async function handler(request, response) {
  if (preflight(request, response)) return;
  try {
    const { userId } = await authenticate(request);
    const sql = getSql();
    if (request.method === "GET") {
      const teamId = String(request.query.team_id || "");
      const cursor = String(request.query.cursor || new Date().toISOString());
      const rows = await sql`
        SELECT r.* FROM review_requests r
        JOIN review_members m ON m.team_id = r.team_id AND m.user_id = ${userId}
        WHERE r.team_id = ${teamId}::uuid
          AND r.created_at < ${cursor}::timestamptz
          AND (m.role IN ('reviewer', 'admin') OR r.requester_id = ${userId})
        ORDER BY r.created_at DESC LIMIT 26`;
      const items = rows.slice(0, 25);
      return response.status(200).json({ items, next_cursor: rows.length > 25 ? items.at(-1).created_at : null });
    }
    if (request.method === "POST") {
      const body = await readJson(request);
      if (!body.team_id || !body.receipt?.receipt_id) throw Object.assign(new Error("team_id and receipt.receipt_id are required."), { statusCode: 400 });
      if (body.receipt.outcome !== "REVIEW") throw Object.assign(new Error("Only REVIEW decision receipts can enter the shared queue."), { statusCode: 400 });
      const rows = await sql`
        WITH member AS (
          SELECT role FROM review_members WHERE team_id = ${body.team_id}::uuid AND user_id = ${userId}
        ), inserted AS (
          INSERT INTO review_requests (id, team_id, receipt, requester_id, assigned_to)
          SELECT ${body.receipt.receipt_id}, ${body.team_id}::uuid, ${JSON.stringify(body.receipt)}::jsonb, ${userId}, ${body.assigned_to || null}
          FROM member WHERE role IN ('requester', 'reviewer', 'admin')
          ON CONFLICT (id) DO NOTHING RETURNING *
        ), event AS (
          INSERT INTO review_events (request_id, actor_id, event_type)
          SELECT id, ${userId}, 'request.created' FROM inserted
        ) SELECT * FROM inserted`;
      if (!rows.length) {
        const existing = await sql`SELECT * FROM review_requests WHERE id = ${body.receipt.receipt_id} AND requester_id = ${userId}`;
        if (existing.length) return response.status(200).json({ request: existing[0], duplicate: true });
        throw Object.assign(new Error("Team membership is required."), { statusCode: 403 });
      }
      return response.status(201).json({ request: rows[0], duplicate: false });
    }
    response.status(405).json({ error: "method_not_allowed" });
  } catch (error) { sendError(response, error); }
}
