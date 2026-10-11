(function (global, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.AnnaVetoLayerReceiptIntegrity = api;
})(globalThis, function () {
  const FORMAT = "anna-vetolayer.integrity.v1";

  function canonicalJson(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function covered(receipt) {
    const clone = structuredClone(receipt);
    delete clone.integrity;
    return clone;
  }

  async function digest(receipt) {
    if (!globalThis.crypto?.subtle) throw new Error("Web Crypto is unavailable.");
    const bytes = new TextEncoder().encode(canonicalJson(covered(receipt)));
    const value = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function verify(receipt, receipts = []) {
    if (receipt?.integrity?.format !== FORMAT || receipt?.integrity?.algorithm !== "sha256" || !/^[a-f0-9]{64}$/.test(receipt?.integrity?.digest || "")) {
      return { status: "unverifiable", label: "Legacy or unverifiable integrity digest", lineage: lineage(receipt, receipts) };
    }
    const actual = await digest(receipt);
    return { status: actual === receipt.integrity.digest ? "valid" : "invalid", label: actual === receipt.integrity.digest ? "Integrity digest verified" : "Integrity digest mismatch", lineage: lineage(receipt, receipts) };
  }

  function lineage(receipt, receipts = []) {
    const index = new Map(receipts.map((item) => [item.receipt_id, item]));
    const chain = [];
    const seen = new Set();
    let current = receipt;
    while (current) {
      if (seen.has(current.receipt_id)) return { status: "broken", chain, reason: "Lineage cycle detected" };
      seen.add(current.receipt_id);
      chain.push(current.receipt_id);
      if (!current.parent_receipt_id) return { status: "valid", chain };
      current = index.get(current.parent_receipt_id);
      if (!current) return { status: "broken", chain, reason: "Parent receipt is missing" };
    }
    return { status: "valid", chain };
  }

  return { FORMAT, canonicalJson, covered, digest, verify, lineage };
});
