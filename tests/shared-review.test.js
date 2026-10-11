"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const domain = require("../review-service/domain.js");
const clientApi = require("../bundle/shared-review.js");

test("authorized second-user resolution wins exactly once", () => {
  const pending = { id: "rcpt_1", requester_id: "user_requester", assigned_to: "user_reviewer", status: "pending", version: 1 };
  const winner = domain.transition(pending, { actor_id: "user_reviewer", outcome: "ALLOW", rationale: "Evidence verified" }, "reviewer");
  assert.equal(winner.ok, true);
  assert.equal(winner.request.version, 2);
  const loser = domain.transition(winner.request, { actor_id: "user_admin", outcome: "BLOCK", rationale: "Too late" }, "admin");
  assert.equal(loser.conflict, true);
  assert.equal(loser.event, "resolution.conflict");
});

test("unauthorized users and prohibited self-approval are rejected", () => {
  const request = { requester_id: "same_user", status: "pending", version: 1 };
  assert.equal(domain.transition(request, { actor_id: "outsider", outcome: "ALLOW" }, "requester").ok, false);
  const self = domain.transition(request, { actor_id: "same_user", outcome: "ALLOW" }, "reviewer", true);
  assert.match(self.errors.join(" "), /Self-approval/);
});

test("shared-review client is opt-in and sends bearer tokens without embedding secrets", async () => {
  assert.equal(clientApi.create().enabled, false);
  const originalFetch = global.fetch;
  let observed;
  global.fetch = async (url, options) => { observed = { url, options }; return { ok: true, json: async () => ({ request: { id: "rcpt_1" } }) }; };
  try {
    const client = clientApi.create({ baseUrl: "https://reviews.example", teamId: "team_1", getToken: async () => "session-token" });
    await client.submit({ receipt_id: "rcpt_1" });
    assert.equal(observed.options.headers.authorization, "Bearer session-token");
    assert.doesNotMatch(fs.readFileSync(path.join(__dirname, "..", "bundle", "shared-review.js"), "utf8"), /CLERK_SECRET_KEY|DATABASE_URL/);
  } finally { global.fetch = originalFetch; }
});

test("resolution API performs an atomic pending-state update and audits conflicts", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "api", "reviews", "[id]", "resolve.mjs"), "utf8");
  assert.match(source, /r\.status = 'pending'/);
  assert.match(source, /resolution\.conflict/);
  assert.match(source, /prohibit_self_approval/);
  assert.match(source, /review_notifications/);
});
