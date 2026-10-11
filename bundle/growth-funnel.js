(function (global, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.AnnaVetoLayerGrowthFunnel = api;
})(globalThis, function () {
  const VERSION = "anna-vetolayer.funnel.v1";
  const STAGES = ["opened", "started", "tool_success", "receipt_viewed"];

  function shouldRecord(runtimeMode, stage, persisted = true) {
    return runtimeMode === "live" && STAGES.includes(stage) && (stage !== "receipt_viewed" || persisted);
  }

  function create(stage, at = new Date().toISOString()) {
    if (!STAGES.includes(stage)) throw new Error("Unsupported funnel stage.");
    return { schema_version: VERSION, stage, at };
  }

  return { VERSION, STAGES, shouldRecord, create };
});
