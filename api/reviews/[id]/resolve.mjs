import { authenticate } from "../../_lib/auth.mjs";
import { getSql } from "../../_lib/db.mjs";
import { preflight, readJson, sendError } from "../../_lib/http.mjs";

export default async function handler(request, response) {
  if (preflight(request, response)) return;
  if (request.method !== "POST") return response.status(405).json({ error: "method_not_allowed" });
  try {
    const { userId } = await authenticate(request);
    const body = await readJson(request);
    const outcome = String(body.outcome || "").toUpperCase();
    if (!['ALLOW', 'BLOCK'].includes(outcome) || !String(body.rationale || "").trim()) throw Object.assign(new Error("outcome and rationale are required."), { statusCode: 400 });
    const sql = getSql();
    const rows = await sql`
      WITH target AS (
        SELECT r.*, t.prohibit_self_approval, m.role
        FROM review_requests r
        JOIN review_teams t ON t.id = r.team_id
        LEFT JOIN review_members m ON m.team_id = r.team_id AND m.user_id = ${userId}
        WHERE r.id = ${String(request.query.id)} FOR UPDATE OF r
      ), decision AS (
        UPDATE review_requests r SET status = 'resolved', outcome = ${outcome}, rationale = ${String(body.rationale).trim()},
          resolved_by = ${userId}, resolved_at = now(), version = r.version + 1
        FROM target t WHERE r.id = t.id AND r.status = 'pending' AND t.role IN ('reviewer', 'admin')
          AND (NOT t.prohibit_self_approval OR t.requester_id <> ${userId})
          AND (r.assigned_to IS NULL OR r.assigned_to = ${userId} OR t.role = 'admin')
        RETURNING r.*
      ), audit AS (
        INSERT INTO review_events (request_id, actor_id, event_type, details)
        SELECT t.id, ${userId}, CASE WHEN d.id IS NULL THEN 'resolution.conflict' ELSE 'resolution.completed' END,
          jsonb_build_object('requested_outcome', ${outcome}, 'winner', d.id IS NOT NULL)
        FROM target t LEFT JOIN decision d ON d.id = t.id RETURNING event_type
      ), notice AS (
        INSERT INTO review_notifications (user_id, request_id, event_type, payload)
        SELECT d.requester_id, d.id, 'review.resolved', jsonb_build_object('outcome', d.outcome, 'resolved_by', d.resolved_by)
        FROM decision d
      )
      SELECT t.id IS NOT NULL AS exists, t.role, t.requester_id, t.prohibit_self_approval,
        t.status AS prior_status, d.*, a.event_type
      FROM target t LEFT JOIN decision d ON d.id = t.id LEFT JOIN audit a ON true`;
    if (!rows.length) throw Object.assign(new Error("Review request not found."), { statusCode: 404 });
    const result = rows[0];
    if (!['reviewer', 'admin'].includes(result.role)) throw Object.assign(new Error("Reviewer membership is required."), { statusCode: 403 });
    if (result.prohibit_self_approval && result.requester_id === userId) throw Object.assign(new Error("Self-approval is prohibited by team policy."), { statusCode: 403 });
    if (result.event_type === "resolution.conflict") return response.status(409).json({ error: "already_resolved", auditable_conflict: true });
    return response.status(200).json({ request: result });
  } catch (error) { sendError(response, error); }
}
