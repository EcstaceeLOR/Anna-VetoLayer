(function (global, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.AnnaVetoLayerReceiptStorage = api;
})(globalThis, function () {
  const PREFIX = "receipts/";
  const LEGACY_KEY = "receipts/index";
  const MIGRATION_KEY = "receipts/migration-v1";
  const PAGE_SIZE = 25;

  const keyFor = (receiptId) => `${PREFIX}${receiptId}`;
  const isReceiptKey = (key) => key.startsWith(PREFIX) && key !== LEGACY_KEY && key !== MIGRATION_KEY;
  const errorCode = (error) => String(error?.code || error?.error?.code || error?.message || "storage_error").toLowerCase();

  async function writeImmutable(storage, receipt) {
    const key = keyFor(receipt.receipt_id);
    const existing = await storage.get({ key });
    if (existing.exists) return { persisted: existing.value?.receipt_id === receipt.receipt_id, duplicate: true };
    try {
      await storage.set({ key, value: receipt, metadata: { schema: receipt.schema_version || "1.1" }, tags: ["decision-receipt", receipt.outcome.toLowerCase()] });
      return { persisted: true, duplicate: false };
    } catch (error) {
      if (errorCode(error).includes("precondition")) {
        const raced = await storage.get({ key });
        if (raced.exists && raced.value?.receipt_id === receipt.receipt_id) return { persisted: true, duplicate: true };
      }
      throw error;
    }
  }

  async function migrateLegacy(storage) {
    const marker = await storage.get({ key: MIGRATION_KEY });
    if (marker.exists && marker.value?.complete) return { migrated: 0, complete: true };
    const legacy = await storage.get({ key: LEGACY_KEY });
    const receipts = legacy.exists && Array.isArray(legacy.value) ? legacy.value : [];
    let migrated = 0;
    for (const receipt of receipts) {
      if (!receipt?.receipt_id) continue;
      const result = await writeImmutable(storage, receipt);
      if (!result.duplicate) migrated += 1;
    }
    const value = { complete: true, migrated_at: new Date().toISOString(), count: receipts.length };
    await storage.set({ key: MIGRATION_KEY, value, if_match: marker.etag, metadata: { schema: "1" }, tags: ["migration"] });
    return { migrated, complete: true };
  }

  async function listPage(storage, cursor) {
    if (typeof storage.list !== "function") {
      if (cursor) return { receipts: [], etags: {}, nextCursor: null };
      const legacy = await storage.get({ key: LEGACY_KEY });
      return { receipts: legacy.exists && Array.isArray(legacy.value) ? legacy.value : [], etags: {}, nextCursor: null };
    }
    const page = await storage.list({ prefix: PREFIX, cursor, limit: PAGE_SIZE });
    const items = (page.items || []).filter((item) => isReceiptKey(item.key));
    const loaded = await Promise.all(items.map(async (item) => ({ item, stored: await storage.get({ key: item.key }) })));
    return {
      receipts: loaded.filter(({ stored }) => stored.exists).map(({ stored }) => stored.value),
      etags: Object.fromEntries(loaded.filter(({ stored }) => stored.exists).map(({ item }) => [item.key, item.etag])),
      nextCursor: page.next_cursor || null
    };
  }

  return { PREFIX, LEGACY_KEY, MIGRATION_KEY, PAGE_SIZE, keyFor, isReceiptKey, errorCode, writeImmutable, migrateLegacy, listPage };
});
