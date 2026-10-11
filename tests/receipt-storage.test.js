"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const receiptStorage = require("../bundle/receipt-storage.js");

function fakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const calls = [];
  return {
    calls,
    values,
    async get({ key }) { return values.has(key) ? { exists: true, value: values.get(key), etag: `etag:${key}` } : { exists: false, value: null }; },
    async set(args) { calls.push(args); values.set(args.key, args.value); return { etag: `etag:${args.key}` }; },
    async list({ prefix, cursor, limit }) {
      const keys = [...values.keys()].filter((key) => key.startsWith(prefix)).sort();
      const start = cursor ? keys.indexOf(cursor) + 1 : 0;
      const slice = keys.slice(start, start + limit);
      return { items: slice.map((key) => ({ key, etag: `etag:${key}` })), next_cursor: start + limit < keys.length ? slice.at(-1) : null };
    }
  };
}

test("migrates the legacy array once and preserves immutable duplicate IDs", async () => {
  const receipt = { receipt_id: "rcpt_a", outcome: "ALLOW" };
  const storage = fakeStorage({ [receiptStorage.LEGACY_KEY]: [receipt] });
  assert.equal((await receiptStorage.migrateLegacy(storage)).migrated, 1);
  assert.equal((await receiptStorage.migrateLegacy(storage)).migrated, 0);
  assert.deepEqual(await receiptStorage.writeImmutable(storage, receipt), { persisted: true, duplicate: true });
  assert.deepEqual(storage.values.get(receiptStorage.keyFor("rcpt_a")), receipt);
});

test("loads receipt history incrementally from APS list pages", async () => {
  const ids = Array.from({ length: 26 }, (_, index) => String(index).padStart(2, "0"));
  const storage = fakeStorage(Object.fromEntries(ids.map((id) => [receiptStorage.keyFor(id), { receipt_id: id }])));
  const page = await receiptStorage.listPage(storage);
  assert.equal(page.receipts.length, receiptStorage.PAGE_SIZE);
  const finalPage = await receiptStorage.listPage(storage, page.nextCursor);
  assert.deepEqual(finalPage.receipts.map((item) => item.receipt_id), ["25"]);
  assert.ok(page.nextCursor);
  assert.equal(finalPage.nextCursor, null);
  assert.equal(receiptStorage.isReceiptKey(receiptStorage.LEGACY_KEY), false);
});

test("falls back to the legacy array when the in-process harness lacks storage.list", async () => {
  const storage = fakeStorage({ [receiptStorage.LEGACY_KEY]: [{ receipt_id: "legacy" }] });
  delete storage.list;
  assert.deepEqual((await receiptStorage.listPage(storage)).receipts, [{ receipt_id: "legacy" }]);
});
