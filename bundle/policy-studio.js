(function (global, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.AnnaVetoLayerPolicyStudio = api;
})(globalThis, function () {
  const VERSION = "anna-vetolayer.policy.v1";
  const templates = {
    production: { name: "Production changes", review_amount: 500, require_rollback_in_production: true, require_evidence_in_production: true, external_communication_review: true },
    payments: { name: "Payments", review_amount: 100, require_rollback_in_production: true, require_evidence_in_production: true, external_communication_review: true },
    access: { name: "Access changes", review_amount: 500, require_rollback_in_production: true, require_evidence_in_production: true, external_communication_review: true },
    data_export: { name: "Data exports", review_amount: 500, require_rollback_in_production: true, require_evidence_in_production: true, external_communication_review: true },
    communications: { name: "External communications", review_amount: 500, require_rollback_in_production: false, require_evidence_in_production: false, external_communication_review: true }
  };
  const editable = ["review_amount", "require_rollback_in_production", "require_evidence_in_production", "external_communication_review"];
  function create(template = "production", revision = 1) {
    const source = templates[template] || templates.production;
    return { schema_version: VERSION, policy_id: `policy_${template}`, revision, name: source.name, status: "draft", rules: Object.fromEntries(editable.map((key) => [key, source[key]])), protected_controls: ["hard-secret-boundary", "hard-public-production-access", "hard-spend-cap"] };
  }
  function validate(policy) {
    const errors = [];
    if (!policy || policy.schema_version !== VERSION) errors.push("Unsupported policy schema.");
    if (!String(policy?.name || "").trim()) errors.push("Policy name is required.");
    const amount = Number(policy?.rules?.review_amount);
    if (!Number.isFinite(amount) || amount < 0 || amount >= 10000) errors.push("review_amount must be between 0 and 9,999.");
    for (const key of editable.slice(1)) if (typeof policy?.rules?.[key] !== "boolean") errors.push(`${key} must be true or false.`);
    if (JSON.stringify(policy?.protected_controls || []) !== JSON.stringify(["hard-secret-boundary", "hard-public-production-access", "hard-spend-cap"])) errors.push("Protected controls cannot be changed.");
    return { ok: errors.length === 0, errors };
  }
  function diff(previous, next) {
    return editable.filter((key) => previous?.rules?.[key] !== next?.rules?.[key]).map((key) => ({ key, before: previous?.rules?.[key], after: next?.rules?.[key] }));
  }
  function activate(policy, previous) {
    const check = validate(policy);
    if (!check.ok) return { ok: false, errors: check.errors };
    return { ok: true, value: { ...structuredClone(policy), status: "active", activated_at: new Date().toISOString(), changes: diff(previous, policy) } };
  }
  return { VERSION, templates, create, validate, diff, activate };
});
