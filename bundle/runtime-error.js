(function (global, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.AnnaVetoLayerRuntimeError = api;
})(globalThis, function () {
  const retryable = new Set(["agent_unavailable", "tool_timeout", "rate_limited", "internal_error"]);
  function code(error) { return String(error?.code || error?.error?.code || "internal_error").toLowerCase(); }
  function describe(error) {
    const value = code(error);
    const messages = {
      agent_unavailable: "Your Anna Agent is unavailable. Keep this request open and retry shortly.",
      permission_denied: "Anna denied this capability. Check the app grant and try again.",
      executa_error: "The policy engine could not evaluate this action. No decision was issued.",
      tool_timeout: "The policy engine timed out. No decision was issued; retry is safe.",
      rate_limited: "Anna is busy. No decision was issued; retry shortly.",
      not_implemented: "This Anna capability is unavailable in the current runtime.",
      malformed_llm_output: "Contextual analysis was unavailable, so this action remains in REVIEW.",
      storage_error: "Receipt persistence failed. This result is marked unpersisted.",
      quota_exceeded: "Anna storage is full. Export the receipt and clear unneeded local history before retrying.",
      precondition_failed: "This receipt changed in another window. Refresh the history and retry the resolution.",
      rate_limited: "Anna is busy. No decision was issued; retry shortly.",
      not_granted: "Anna storage access is not granted for this app."
    };
    return { code: value, retryable: retryable.has(value), message: messages[value] || "Anna could not complete this request. No decision was issued." };
  }
  return { describe, code };
});
