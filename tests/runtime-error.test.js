"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const runtime = require("../bundle/runtime-error.js");

test("maps every Anna host error used by the app to a safe recovery state", () => {
  for (const code of ["agent_unavailable", "permission_denied", "executa_error", "tool_timeout", "rate_limited", "not_implemented", "malformed_llm_output", "storage_error", "quota_exceeded", "precondition_failed", "not_granted"]) {
    const details = runtime.describe({ code });
    assert.equal(details.code, code);
    assert.doesNotMatch(details.message, /allow|safe to execute/i);
  }
  assert.equal(runtime.describe({ code: "tool_timeout" }).retryable, true);
  assert.equal(runtime.describe({ code: "permission_denied" }).retryable, false);
});
