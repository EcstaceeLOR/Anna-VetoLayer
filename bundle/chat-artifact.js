(function (global, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.AnnaVetoLayerChat = api;
})(globalThis, function () {
  function required(value, field) {
    if (value === undefined || value === null || String(value).trim() === "") {
      throw new Error(`Cannot share a receipt without ${field}.`);
    }
    return value;
  }

  function actionSummary(action) {
    const operation = required(action?.operation, "an action operation");
    const target = required(action?.target, "an action target");
    const environment = String(action?.environment || "unspecified");
    return `${operation} on ${target} (${environment})`.slice(0, 240);
  }

  function createReceiptArtifact(receipt) {
    const outcome = String(required(receipt?.outcome, "an outcome")).toUpperCase();
    const receiptId = String(required(receipt?.receipt_id, "a receipt ID"));
    const riskScore = Number(receipt?.risk_score);
    if (!Number.isFinite(riskScore)) throw new Error("Cannot share a receipt without a risk score.");

    const summary = actionSummary(receipt.action);
    return {
      kind: "app_event",
      summary: `Anna VetoLayer ${outcome}: ${summary}`,
      data: {
        schema_version: "anna-vetolayer.chat-artifact.v1",
        receipt_id: receiptId,
        outcome,
        risk_score: Math.max(0, Math.min(100, riskScore)),
        action_summary: summary,
        decided_at: receipt.decided_at || receipt.evaluated_at || null,
        receipt_digest: receipt.integrity?.digest || null
      }
    };
  }

  function describeHandoffError(error) {
    const code = String(error?.code || error?.error?.code || "").toLowerCase();
    if (code === "permission_denied") return "Anna denied permission to add a conversation card.";
    if (code === "not_implemented") return "Conversation cards are not available in this Anna runtime.";
    if (code === "rate_limited") return "Conversation handoff is busy. Please try again shortly.";
    return "Conversation card was not added. Please try again.";
  }

  return { createReceiptArtifact, describeHandoffError };
});
