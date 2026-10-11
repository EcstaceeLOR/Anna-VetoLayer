"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const integrity = require("../bundle/receipt-integrity.js");
const { canonicalJson } = require("../executas/policy-engine/policy-engine.js");

const receipt = { schema_version: "1.1", receipt_id: "rcpt_golden", action: { target: "payments", operation: "read" }, outcome: "ALLOW" };
const expected = "a0a9c1526c2f2e7b764d56b9c38725d4d5cc3ae213c0a1c870ab8b92272073c6";

test("canonical JSON has a shared cross-runtime golden vector", () => {
  assert.equal(integrity.canonicalJson(receipt), canonicalJson(receipt));
  assert.equal(crypto.createHash("sha256").update(canonicalJson(receipt)).digest("hex"), expected);
});

test("verification detects tampering and broken lineage", async () => {
  const signed = { ...receipt, integrity: { format: integrity.FORMAT, algorithm: "sha256", digest: await integrity.digest(receipt) } };
  assert.equal((await integrity.verify(signed, [signed])).status, "valid");
  const altered = { ...signed, outcome: "BLOCK" };
  assert.equal((await integrity.verify(altered, [altered])).status, "invalid");
  assert.equal((await integrity.verify({ ...signed, parent_receipt_id: "rcpt_missing" }, [signed])).lineage.status, "broken");
  assert.equal((await integrity.verify({ ...receipt, integrity: { algorithm: "sha256", digest: "abc" } })).status, "unverifiable");
});

test("a valid child receipt has a compact two-receipt lineage", async () => {
  const parent = { ...receipt, integrity: { format: integrity.FORMAT, algorithm: "sha256", digest: await integrity.digest(receipt) } };
  const childBase = { ...receipt, receipt_id: "rcpt_child", parent_receipt_id: parent.receipt_id };
  const child = { ...childBase, integrity: { format: integrity.FORMAT, algorithm: "sha256", digest: await integrity.digest(childBase) } };
  const verified = await integrity.verify(child, [child, parent]);
  assert.deepEqual(verified.lineage, { status: "valid", chain: ["rcpt_child", "rcpt_golden"] });
});
