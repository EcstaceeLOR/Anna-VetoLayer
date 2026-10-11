"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const policy = require("../bundle/policy-studio.js");

test("creates validated versioned templates with immutable protected controls", () => {
  const draft = policy.create("payments", 2);
  assert.equal(policy.validate(draft).ok, true);
  assert.match(draft.policy_id, /payments/);
  const weakened = { ...draft, protected_controls: [] };
  assert.equal(policy.validate(weakened).ok, false);
});

test("shows a readable activation diff and rejects conflicting threshold", () => {
  const prior = policy.create("production", 1);
  const next = policy.create("production", 2);
  next.rules.review_amount = 250;
  const activated = policy.activate(next, prior);
  assert.equal(activated.ok, true);
  assert.deepEqual(activated.value.changes, [{ key: "review_amount", before: 500, after: 250 }]);
  next.rules.review_amount = 10000;
  assert.equal(policy.activate(next, prior).ok, false);
});
