import { authenticate } from "../../_lib/auth.mjs";
import { getSql } from "../../_lib/db.mjs";
import { preflight, readJson, sendError } from "../../_lib/http.mjs";

export default async function handler(request, response) {
  if (preflight(request, response)) return;
  if (request.method !== "PATCH") return response.status(405).json({ error: "method_not_allowed" });
  try {
    const { userId } = await authenticate(request);
    const body = await readJson(request);
    const sql = getSql();
    const rows = await sql`
      UPDATE review_requests r SET assigned_to = ${body.assigned_to || null}, version = version + 1
      FROM review_members actor, review_members assignee
      WHERE r.id = ${String(request.query.id)} AND actor.team_id = r.team_id AND actor.user_id = ${userId}
        AND actor.role IN ('reviewer', 'admin') AND assignee.team_id = r.team_id
        AND assignee.user_id = ${body.assigned_to} AND assignee.role IN ('reviewer', 'admin')
      RETURNING r.*`;
    if (!rows.length) throw Object.assign(new Error("Authorized reviewer and valid assignee are required."), { statusCode: 403 });
    response.status(200).json({ request: rows[0] });
  } catch (error) { sendError(response, error); }
}
