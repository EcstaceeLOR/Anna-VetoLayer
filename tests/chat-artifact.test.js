"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const chat = require("../bundle/chat-artifact.js");

const receipt = {
  receipt_id: "rcpt_123",
  outcome: "review",
  risk_score: 72,
  decided_at: "2026-10-11T20:00:00.000Z",
  action: {
    actor: "Release Agent",
    operation: "deploy-production",
    target: "payments-api@v2.4.0",
    environment: "production",
    impact: "code",
    evidence: ["Sensitive release evidence"]
  },
  findings: [{ summary: "Sensitive finding" }],
  integrity: { digest: "sha256:abc" }
};

test("builds the documented nested transient Anna artifact without sensitive evidence", () => {
  const artifact = chat.createReceiptArtifact(receipt);
  assert.equal(artifact.kind, "app_event");
  assert.match(artifact.summary, /^Anna VetoLayer REVIEW:/);
  assert.deepEqual(artifact.data, {
    schema_version: "anna-vetolayer.chat-artifact.v1",
    receipt_id: "rcpt_123",
    outcome: "REVIEW",
    risk_score: 72,
    action_summary: "deploy-production on payments-api@v2.4.0 (production)",
    decided_at: "2026-10-11T20:00:00.000Z",
    receipt_digest: "sha256:abc"
  });
  assert.doesNotMatch(JSON.stringify(artifact), /Sensitive|evidence|findings/i);
});

test("formats permission and availability failures without reporting success", () => {
  assert.match(chat.describeHandoffError({ code: "permission_denied" }), /denied permission/i);
  assert.match(chat.describeHandoffError({ code: "not_implemented" }), /not available/i);
  assert.match(chat.describeHandoffError(new Error("network")), /not added/i);
});
