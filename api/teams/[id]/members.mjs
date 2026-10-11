import { authenticate } from "../../_lib/auth.mjs";
import { getSql } from "../../_lib/db.mjs";
import { preflight, readJson, sendError } from "../../_lib/http.mjs";

export default async function handler(request, response) {
  if (preflight(request, response)) return;
  if (request.method !== "POST") return response.status(405).json({ error: "method_not_allowed" });
  try {
    const { userId } = await authenticate(request);
    const body = await readJson(request);
    if (!body.user_id || !['requester', 'reviewer', 'admin'].includes(body.role)) throw Object.assign(new Error("user_id and a valid role are required."), { statusCode: 400 });
    const sql = getSql();
    const rows = await sql`
      INSERT INTO review_members (team_id, user_id, role)
      SELECT ${String(request.query.id)}::uuid, ${body.user_id}, ${body.role}
      FROM review_members WHERE team_id = ${String(request.query.id)}::uuid AND user_id = ${userId} AND role = 'admin'
      ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role RETURNING *`;
    if (!rows.length) throw Object.assign(new Error("Team admin membership is required."), { statusCode: 403 });
    response.status(201).json({ member: rows[0] });
  } catch (error) { sendError(response, error); }
}
