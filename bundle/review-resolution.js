(function (global, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.AnnaVetoLayerReviewResolution = api;
})(globalThis, function () {
  function text(value) {
    return String(value || "").trim();
  }

  function needsHighRiskAcknowledgement(receipt) {
    return Number(receipt.risk_score) >= 50 || receipt.action?.environment === "production" || Number(receipt.action?.amount) >= 500;
  }

  function validate(receipt, resolution, review) {
    const errors = [];
    const rationale = text(review?.rationale);
    const evidence = Object.fromEntries(Object.entries(review?.evidence || {}).map(([key, value]) => [key, text(value)]));
    if (rationale.length < 12) errors.push("Add a rationale of at least 12 characters.");
    if (resolution === "ALLOW") {
      if (receipt.hard_block) errors.push("An authoritative BLOCK cannot be approved.");
      for (const requirement of receipt.missing_evidence || []) {
        if (!evidence[requirement] || evidence[requirement].length < 3) errors.push(`Provide evidence for ${requirement.replaceAll("-", " ")}.`);
      }
      if (needsHighRiskAcknowledgement(receipt) && !review?.acknowledged_high_risk) errors.push("Acknowledge the high-risk review before approving.");
    }
    return errors.length ? { ok: false, errors } : { ok: true, value: { rationale, evidence, acknowledged_high_risk: Boolean(review?.acknowledged_high_risk) } };
  }

  function applyEvidence(action, evidence) {
    const next = structuredClone(action || {});
    const supportingEvidence = [...(next.evidence || [])];
    for (const [requirement, detail] of Object.entries(evidence || {})) {
      if (!detail) continue;
      if (requirement === "rollback-plan") next.rollback_plan = detail;
      else if (requirement === "clear-intent") next.summary = detail;
      else supportingEvidence.push(`reviewed ${requirement}: ${detail}`);
    }
    next.evidence = [...new Set(supportingEvidence)];
    return next;
  }

  function alreadyResolved(receipts, receiptId) {
    return (receipts || []).some((receipt) => receipt.parent_receipt_id === receiptId);
  }

  return { needsHighRiskAcknowledgement, validate, applyEvidence, alreadyResolved };
});
