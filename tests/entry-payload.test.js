"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const entry = require("../bundle/entry-payload.js");

const payload = {
  schema_version: entry.VERSION,
  request_id: "request-123",
  action: {
    actor: "Release Agent",
    tool: "github",
    operation: "deploy-production",
    target: "payments-api@v2.4.0",
    environment: "production",
    impact: "code",
    summary: "Deploy an approved release.",
    amount: 0,
    evidence: ["CI passed"],
    permissions: ["deployments:write"],
    rollback_plan: "Deploy the previous version."
  }
};

test("parses a versioned launch payload deterministically", () => {
  const parsed = entry.parse(payload);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.action.permissions[0], "deployments:write");
  assert.equal(entry.parse(payload).fingerprint, parsed.fingerprint);
});

test("gives an updated request a new deterministic fingerprint without changing its request ID", () => {
  const merged = entry.parse({
    ...payload,
    action: { ...payload.action, target: "payments-api@v2.4.1", evidence: ["CI passed", "Change approved"] }
  });
  assert.equal(merged.ok, true);
  assert.equal(merged.value.request_id, "request-123");
  assert.notEqual(merged.fingerprint, entry.parse(payload).fingerprint);
});

test("rejects partial and invalid payloads without producing a form action", () => {
  const partial = entry.parse({ schema_version: entry.VERSION, action: { actor: "<img src=x onerror=1>" } });
  assert.equal(partial.ok, false);
  assert.match(partial.errors.join(" "), /tool is required/i);
  const invalid = entry.parse({ ...payload, action: { ...payload.action, environment: "planet" } });
  assert.equal(invalid.ok, false);
  assert.match(invalid.errors.join(" "), /environment is not supported/i);
});
