import { authenticate } from "../../_lib/auth.mjs";
import { getSql } from "../../_lib/db.mjs";
import { preflight, readJson, sendError } from "../../_lib/http.mjs";

export default async function handler(request, response) {
  if (preflight(request, response)) return;
  if (request.method !== "POST") return response.status(405).json({ error: "method_not_allowed" });
  try {
    const { userId } = await authenticate(request);
    const body = await readJson(request);
    const comment = String(body.comment || "").trim();
    if (!comment || comment.length > 4000) throw Object.assign(new Error("A comment of up to 4,000 characters is required."), { statusCode: 400 });
    const sql = getSql();
    const rows = await sql`
      INSERT INTO review_comments (request_id, author_id, body)
      SELECT r.id, ${userId}, ${comment} FROM review_requests r
      JOIN review_members m ON m.team_id = r.team_id AND m.user_id = ${userId}
      WHERE r.id = ${String(request.query.id)} RETURNING *`;
    if (!rows.length) throw Object.assign(new Error("Membership is required."), { statusCode: 403 });
    response.status(201).json({ comment: rows[0] });
  } catch (error) { sendError(response, error); }
}
