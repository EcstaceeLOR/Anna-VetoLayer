(function (global, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.AnnaVetoLayerSharedReview = api;
})(globalThis, function () {
  function create(config = {}) {
    const baseUrl = String(config.baseUrl || "").replace(/\/$/, "");
    const enabled = Boolean(baseUrl && config.teamId && typeof config.getToken === "function");
    async function request(path, options = {}) {
      if (!enabled) throw new Error("Shared review is not configured.");
      const token = await config.getToken();
      if (!token) throw new Error("Shared review authentication is required.");
      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(options.headers || {}) }
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(body.error || "Shared review request failed."), { status: response.status, details: body });
      return body;
    }
    return {
      enabled,
      submit: (receipt) => request("/api/reviews", { method: "POST", body: JSON.stringify({ team_id: config.teamId, receipt }) }),
      list: (cursor) => request(`/api/reviews?team_id=${encodeURIComponent(config.teamId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`),
      resolve: (id, outcome, rationale) => request(`/api/reviews/${encodeURIComponent(id)}/resolve`, { method: "POST", body: JSON.stringify({ outcome, rationale }) }),
      comment: (id, comment) => request(`/api/reviews/${encodeURIComponent(id)}/comments`, { method: "POST", body: JSON.stringify({ comment }) }),
      notifications: () => request("/api/notifications")
    };
  }
  return { create };
});
