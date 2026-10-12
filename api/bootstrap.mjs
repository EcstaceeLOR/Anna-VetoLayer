import { authenticate } from "./_lib/auth.mjs";
import { getSql } from "./_lib/db.mjs";
import { preflight, sendError } from "./_lib/http.mjs";

export default async function handler(request, response) {
  if (preflight(request, response)) return;
  if (request.method !== "POST") return response.status(405).json({ error: "method_not_allowed" });

  try {
    const { userId } = await authenticate(request);
    const sql = getSql();
    const created = await sql`
      WITH team AS (
        INSERT INTO review_teams (slug, name, prohibit_self_approval)
        SELECT 'anna-vetolayer', 'Anna VetoLayer Review Team', true
        WHERE NOT EXISTS (SELECT 1 FROM review_teams)
        ON CONFLICT (slug) DO NOTHING
        RETURNING *
      ), membership AS (
        INSERT INTO review_members (team_id, user_id, role)
        SELECT id, ${userId}, 'admin' FROM team
        RETURNING team_id, role
      )
      SELECT team.id AS team_id, team.name AS team_name, membership.role
      FROM team JOIN membership ON membership.team_id = team.id`;

    if (created.length) return response.status(201).json({ membership: created[0] });

    const existing = await sql`
      SELECT t.id AS team_id, t.name AS team_name, m.role
      FROM review_members m JOIN review_teams t ON t.id = m.team_id
      WHERE m.user_id = ${userId} AND t.slug = 'anna-vetolayer'`;
    if (existing.length) return response.status(200).json({ membership: existing[0], existing: true });
    throw Object.assign(new Error("The review team is already initialized. Ask its admin to add your user ID."), { statusCode: 409 });
  } catch (error) {
    sendError(response, error);
  }
}
