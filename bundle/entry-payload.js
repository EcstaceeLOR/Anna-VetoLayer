(function (global, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.AnnaVetoLayerEntryPayload = api;
})(globalThis, function () {
  const VERSION = "anna-vetolayer.entry-payload.v1";
  const requiredFields = ["actor", "tool", "operation", "target", "environment", "impact", "summary"];
  const environments = new Set(["sandbox", "development", "staging", "production"]);
  const impacts = new Set(["code", "finance", "access", "data", "communication", "infrastructure"]);

  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function list(value, field, errors) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.some((item) => !text(item))) {
      errors.push(`${field} must be a list of non-empty strings.`);
      return [];
    }
    return value.map(text).slice(0, 20);
  }

  function parse(payload) {
    const errors = [];
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { ok: false, errors: ["Payload must be an object."] };
    if (payload.schema_version !== VERSION) return { ok: false, errors: [`schema_version must be ${VERSION}.`] };
    if (!payload.action || typeof payload.action !== "object" || Array.isArray(payload.action)) return { ok: false, errors: ["action must be an object."] };

    const action = {};
    for (const field of requiredFields) {
      action[field] = text(payload.action[field]);
      if (!action[field]) errors.push(`${field} is required.`);
    }
    if (action.environment && !environments.has(action.environment)) errors.push("environment is not supported.");
    if (action.impact && !impacts.has(action.impact)) errors.push("impact is not supported.");
    const amount = payload.action.amount === undefined ? 0 : Number(payload.action.amount);
    if (!Number.isFinite(amount) || amount < 0) errors.push("amount must be a non-negative number.");
    action.amount = Number.isFinite(amount) && amount >= 0 ? amount : 0;
    action.recipient = text(payload.action.recipient);
    action.rollback_plan = text(payload.action.rollback_plan);
    action.evidence = list(payload.action.evidence, "evidence", errors);
    action.permissions = list(payload.action.permissions, "permissions", errors);
    const requestId = payload.request_id === undefined ? "" : text(payload.request_id);
    if (payload.request_id !== undefined && !requestId) errors.push("request_id must be a non-empty string.");
    if (errors.length) return { ok: false, errors };

    const value = { schema_version: VERSION, request_id: requestId, action };
    return { ok: true, value, fingerprint: JSON.stringify(value) };
  }

  return { VERSION, parse };
});
