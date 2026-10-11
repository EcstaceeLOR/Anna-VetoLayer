"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const funnel = require("../bundle/growth-funnel.js");

test("records only genuine live-runtime stages", () => {
  assert.equal(funnel.shouldRecord("live", "opened"), true);
  assert.equal(funnel.shouldRecord("preview", "opened"), false);
  assert.equal(funnel.shouldRecord("error", "tool_success"), false);
  assert.equal(funnel.shouldRecord("live", "receipt_viewed", false), false);
});

test("funnel events exclude action and user content", () => {
  const event = funnel.create("started", "2026-10-11T10:00:00.000Z");
  assert.deepEqual(event, {
    schema_version: funnel.VERSION,
    stage: "started",
    at: "2026-10-11T10:00:00.000Z"
  });
  assert.throws(() => funnel.create("preview"), /Unsupported funnel stage/);
});
