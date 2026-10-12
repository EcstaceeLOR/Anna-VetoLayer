"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateAction, handleRequest } = require("./policy-engine.js");

const base = {
  actor: "Release Agent",
  tool: "github",
  operation: "read checks",
  target: "identity-api",
  environment: "staging",
  summary: "Inspect the latest continuous integration results before planning a release.",
  impact: "code",
  evidence: []
};

test("allows a low-risk read", () => {
  const result = evaluateAction(base, new Date("2026-10-11T10:00:00.000Z"));
  assert.equal(result.outcome, "ALLOW");
  assert.equal(result.hard_block, false);
  assert.equal(result.integrity.format, "anna-vetolayer.integrity.v1");
  assert.match(result.integrity.digest, /^[a-f0-9]{64}$/);
});

test("blocks secret exfiltration", () => {
  const result = evaluateAction(
    { ...base, operation: "export secret tokens", summary: "Export secret tokens to an external debugging endpoint." },
    new Date("2026-10-11T10:00:00.000Z")
  );
  assert.equal(result.outcome, "BLOCK");
  assert.equal(result.hard_block, true);
  assert.equal(result.risk_score, 100);
});

test("holds an unsupported production deploy for review", () => {
  const result = evaluateAction(
    {
      ...base,
      operation: "deploy",
      environment: "production",
      summary: "Deploy the tested release candidate to the production identity service."
    },
    new Date("2026-10-11T10:00:00.000Z")
  );
  assert.equal(result.outcome, "REVIEW");
  assert.deepEqual(result.missing_evidence.sort(), ["rollback-plan", "verified-change-evidence"]);
  assert.equal(result.can_ai_allow, false);
});

test("preserves requested permissions in the decision receipt", () => {
  const receipt = evaluateAction({
    actor: "Release Agent",
    tool: "github",
    operation: "deploy",
    target: "payments-api",
    environment: "staging",
    impact: "code",
    summary: "Deploy the approved staging release.",
    permissions: ["deployments:write"]
  });
  assert.deepEqual(receipt.action.permissions, ["deployments:write"]);
});

test("describe returns the bare tool manifest", () => {
  const response = handleRequest({ jsonrpc: "2.0", id: 1, method: "describe" });
  const protocolManifest = require("./manifest.json");
  const executa = require("./executa.json");
  const packageJson = require("./package.json");
  assert.deepEqual(response.result, protocolManifest);
  assert.equal(response.result.version, executa.version);
  assert.equal(response.result.version, packageJson.version);
  assert.equal(response.result.name, "anna-vetolayer-policy-engine");
  assert.ok(Array.isArray(response.result.tools[0].parameters));
  assert.equal(response.result.tools[0].description.length > 0, true);
});

test("protocol handles health, invalid invoke input, and unknown methods", () => {
  const health = handleRequest({ jsonrpc: "2.0", id: 2, method: "health" });
  assert.equal(health.result?.status, "ready");
  const invalid = handleRequest({ jsonrpc: "2.0", id: 3, method: "invoke", params: { tool: "evaluate_action", arguments: null } });
  assert.equal(invalid.result?.data?.outcome, "REVIEW");
  const unknown = handleRequest({ jsonrpc: "2.0", id: 4, method: "unknown" });
  assert.equal(unknown.error?.code, -32601);
});
