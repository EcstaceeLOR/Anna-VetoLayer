import { authenticate } from "./_lib/auth.mjs";
import { getSql } from "./_lib/db.mjs";
import { preflight, sendError } from "./_lib/http.mjs";

export default async function handler(request, response) {
  if (preflight(request, response)) return;
  if (request.method !== "GET") return response.status(405).json({ error: "method_not_allowed" });

  try {
    const { userId } = await authenticate(request);
    const sql = getSql();
    const memberships = await sql`
      SELECT t.id AS team_id, t.name AS team_name, t.prohibit_self_approval, m.role
      FROM review_members m
      JOIN review_teams t ON t.id = m.team_id
      WHERE m.user_id = ${userId}
      ORDER BY t.created_at`;
    const [availability] = await sql`SELECT NOT EXISTS (SELECT 1 FROM review_teams) AS can_bootstrap`;
    return response.status(200).json({ user_id: userId, memberships, can_bootstrap: availability.can_bootstrap });
  } catch (error) {
    sendError(response, error);
  }
}
