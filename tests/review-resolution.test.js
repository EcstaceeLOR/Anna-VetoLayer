"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const review = require("../bundle/review-resolution.js");

const parent = {
  receipt_id: "rcpt_parent",
  outcome: "REVIEW",
  hard_block: false,
  risk_score: 72,
  missing_evidence: ["rollback-plan", "verified-change-evidence"],
  action: { environment: "production", summary: "Deploy release", rollback_plan: "", evidence: [] }
};

test("a note alone cannot approve a review", () => {
  const result = review.validate(parent, "ALLOW", { rationale: "This seems safe." });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /rollback plan/i);
});

test("requires every evidence gap and high-risk acknowledgement before allow", () => {
  const result = review.validate(parent, "ALLOW", {
    rationale: "The release and rollback evidence were independently verified.",
    evidence: { "rollback-plan": "Deploy the prior release.", "verified-change-evidence": "CI run 4821 passed." },
    acknowledged_high_risk: true
  });
  assert.equal(result.ok, true);
  const action = review.applyEvidence(parent.action, result.value.evidence);
  assert.equal(action.rollback_plan, "Deploy the prior release.");
  assert.match(action.evidence[0], /verified-change-evidence/);
});

test("rejects attempted BLOCK overrides and stale evidence", () => {
  const blocked = review.validate({ ...parent, hard_block: true }, "ALLOW", { rationale: "Enough evidence now.", evidence: { "rollback-plan": "undo", "verified-change-evidence": "proof" }, acknowledged_high_risk: true });
  assert.equal(blocked.ok, false);
  assert.match(blocked.errors.join(" "), /cannot be approved/i);
  const stale = review.validate(parent, "ALLOW", { rationale: "Enough evidence now.", evidence: { "rollback-plan": "undo" }, acknowledged_high_risk: true });
  assert.equal(stale.ok, false);
  assert.match(stale.errors.join(" "), /verified change evidence/i);
});

test("does not resolve the same parent review twice", () => {
  assert.equal(review.alreadyResolved([{ parent_receipt_id: "rcpt_parent" }], "rcpt_parent"), true);
  assert.equal(review.alreadyResolved([{ parent_receipt_id: "rcpt_other" }], "rcpt_parent"), false);
});
