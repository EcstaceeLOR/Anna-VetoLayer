"use strict";

const MEMBER_ROLES = new Set(["requester", "reviewer", "admin"]);
const REVIEW_ROLES = new Set(["reviewer", "admin"]);
const OUTCOMES = new Set(["ALLOW", "BLOCK"]);

function canCreate(role) {
  return MEMBER_ROLES.has(role);
}

function canReview(role) {
  return REVIEW_ROLES.has(role);
}

function validateResolution({ role, actorId, requesterId, outcome, prohibitSelfApproval = true }) {
  const errors = [];
  if (!canReview(role)) errors.push("Reviewer membership is required.");
  if (!OUTCOMES.has(String(outcome || "").toUpperCase())) errors.push("Outcome must be ALLOW or BLOCK.");
  if (prohibitSelfApproval && actorId === requesterId) errors.push("Self-approval is prohibited by team policy.");
  return { ok: errors.length === 0, errors };
}

function transition(request, attempt, role, prohibitSelfApproval = true) {
  const checked = validateResolution({ role, actorId: attempt.actor_id, requesterId: request.requester_id, outcome: attempt.outcome, prohibitSelfApproval });
  if (!checked.ok) return { ok: false, errors: checked.errors, event: "resolution.rejected" };
  if (request.status !== "pending") return { ok: false, conflict: true, event: "resolution.conflict", request };
  if (request.assigned_to && request.assigned_to !== attempt.actor_id && role !== "admin") return { ok: false, errors: ["The request is assigned to another reviewer."], event: "resolution.rejected" };
  return { ok: true, event: "resolution.completed", request: { ...request, status: "resolved", outcome: attempt.outcome, rationale: attempt.rationale, resolved_by: attempt.actor_id, version: request.version + 1 } };
}

function publicRequest(row) {
  return {
    id: row.id,
    team_id: row.team_id,
    receipt: row.receipt,
    requester_id: row.requester_id,
    assigned_to: row.assigned_to,
    status: row.status,
    outcome: row.outcome,
    version: row.version,
    created_at: row.created_at,
    resolved_at: row.resolved_at
  };
}

module.exports = { MEMBER_ROLES, REVIEW_ROLES, OUTCOMES, canCreate, canReview, validateResolution, transition, publicRequest };
