(function () {
  const $ = (id) => document.getElementById(id);
  const state = { clerk: null, profile: null, membership: null };

  function notice(message, error = false) {
    const node = $("notice");
    node.textContent = message;
    node.classList.toggle("error", error);
    node.hidden = !message;
  }

  async function loadScript(src, attributes = {}) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.crossOrigin = "anonymous";
      Object.entries(attributes).forEach(([name, value]) => script.setAttribute(name, value));
      script.onload = resolve;
      script.onerror = () => reject(new Error("Authentication components could not be loaded."));
      document.head.appendChild(script);
    });
  }

  async function initializeClerk(publishableKey) {
    const encodedDomain = publishableKey.split("_")[2];
    if (!encodedDomain) throw new Error("The authentication publishable key is invalid.");
    const domain = atob(encodedDomain).slice(0, -1);
    await loadScript(`https://${domain}/npm/@clerk/ui@1/dist/ui.browser.js`);
    await loadScript(`https://${domain}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, { "data-clerk-publishable-key": publishableKey });
    await window.Clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } });
    return window.Clerk;
  }

  async function api(path, options = {}) {
    const token = await state.clerk.session?.getToken();
    if (!token) throw new Error("Sign in is required.");
    const response = await fetch(path, {
      ...options,
      headers: { authorization: `Bearer ${token}`, ...(options.body ? { "content-type": "application/json" } : {}), ...(options.headers || {}) }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.error || "The request failed."), { status: response.status });
    return body;
  }

  async function loadProfile() {
    state.profile = await api("/api/me");
    state.membership = state.profile.memberships[0] || null;
    $("user-id").textContent = state.profile.user_id;
    $("dashboard").hidden = false;
    if (!state.membership) {
      $("onboarding").hidden = false;
      $("workspace").hidden = true;
      $("onboarding-copy").textContent = state.profile.can_bootstrap
        ? "You are the first member. Initialize the team to become its administrator."
        : "Send this user ID to the team administrator. Refresh after they add you as a requester or reviewer.";
      $("bootstrap-team").hidden = !state.profile.can_bootstrap;
      return;
    }

    $("onboarding").hidden = true;
    $("workspace").hidden = false;
    $("team-name").textContent = state.membership.team_name;
    $("role-label").textContent = `${state.membership.role.toUpperCase()} · SELF-APPROVAL ${state.membership.prohibit_self_approval ? "BLOCKED" : "ALLOWED"}`;
    $("member-panel").hidden = state.membership.role !== "admin";
    await loadQueue();
  }

  function actionTitle(receipt) {
    const action = receipt.action || {};
    return [action.operation, action.target].filter(Boolean).join(" → ") || receipt.receipt_id;
  }

  function buildReviewCard(item) {
    const card = document.createElement("article");
    card.className = "review-card panel";
    const header = document.createElement("header");
    const heading = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = item.receipt?.action?.environment || "REVIEW REQUEST";
    const title = document.createElement("h3");
    title.textContent = actionTitle(item.receipt || {});
    heading.append(eyebrow, title);
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = item.status.toUpperCase();
    header.append(heading, pill);

    const summary = document.createElement("p");
    summary.textContent = item.receipt?.contextual_analysis?.summary || item.receipt?.summary || "Human review requested.";
    const meta = document.createElement("div");
    meta.className = "meta";
    [
      `Requester ${item.requester_id}`,
      `Risk ${item.receipt?.risk_score ?? "—"}`,
      new Date(item.created_at).toLocaleString()
    ].forEach((value) => { const span = document.createElement("span"); span.textContent = value; meta.append(span); });
    card.append(header, summary, meta);

    if (item.status === "pending" && ["reviewer", "admin"].includes(state.membership.role)) {
      const resolution = document.createElement("div");
      resolution.className = "resolution";
      const rationale = document.createElement("textarea");
      rationale.placeholder = "Required reviewer rationale";
      rationale.setAttribute("aria-label", `Rationale for ${item.id}`);
      const allow = document.createElement("button");
      allow.className = "allow";
      allow.type = "button";
      allow.textContent = "Allow";
      const block = document.createElement("button");
      block.className = "block";
      block.type = "button";
      block.textContent = "Block";
      allow.addEventListener("click", () => resolveReview(item.id, "ALLOW", rationale.value, allow));
      block.addEventListener("click", () => resolveReview(item.id, "BLOCK", rationale.value, block));
      resolution.append(rationale, allow, block);
      card.append(resolution);
    }
    return card;
  }

  async function loadQueue() {
    if (!state.membership) return;
    const body = await api(`/api/reviews?team_id=${encodeURIComponent(state.membership.team_id)}`);
    const list = $("review-list");
    list.replaceChildren(...body.items.map(buildReviewCard));
    $("queue-empty").hidden = body.items.length > 0;
  }

  async function resolveReview(id, outcome, rationale, button) {
    if (!rationale.trim()) return notice("A reviewer rationale is required.", true);
    button.disabled = true;
    try {
      await api(`/api/reviews/${encodeURIComponent(id)}/resolve`, { method: "POST", body: JSON.stringify({ outcome, rationale }) });
      notice(`${id} was resolved ${outcome}.`);
      await loadQueue();
    } catch (error) {
      notice(error.message, true);
    } finally {
      button.disabled = false;
    }
  }

  async function initialize() {
    try {
      const response = await fetch("/api/config");
      const config = await response.json();
      if (!response.ok) throw new Error(config.error || "Portal configuration is unavailable.");
      state.clerk = await initializeClerk(config.publishableKey);
      $("loading").hidden = true;
      if (!state.clerk.user) {
        $("sign-in-panel").hidden = false;
        state.clerk.mountSignIn($("sign-in"));
        return;
      }
      state.clerk.mountUserButton($("user-button"));
      await loadProfile();
    } catch (error) {
      $("loading").hidden = true;
      notice(error.message, true);
    }
  }

  $("copy-user-id").addEventListener("click", async () => {
    await navigator.clipboard.writeText(state.profile?.user_id || "");
    notice("User ID copied.");
  });
  $("refresh-queue").addEventListener("click", () => loadProfile().catch((error) => notice(error.message, true)));
  $("bootstrap-team").addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    try { await api("/api/bootstrap", { method: "POST" }); await loadProfile(); notice("Review team initialized."); }
    catch (error) { notice(error.message, true); }
    finally { event.currentTarget.disabled = false; }
  });
  $("member-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    button.disabled = true;
    try {
      await api(`/api/teams/${encodeURIComponent(state.membership.team_id)}/members`, {
        method: "POST",
        body: JSON.stringify({ user_id: $("member-user-id").value.trim(), role: $("member-role").value })
      });
      event.currentTarget.reset();
      notice("Membership saved.");
    } catch (error) { notice(error.message, true); }
    finally { button.disabled = false; }
  });
  $("receipt-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    button.disabled = true;
    try {
      const file = $("receipt-file").files[0];
      const receipt = JSON.parse(await file.text());
      if (!receipt.receipt_id || receipt.outcome !== "REVIEW") throw new Error("Choose an exported REVIEW decision receipt.");
      await api("/api/reviews", { method: "POST", body: JSON.stringify({ team_id: state.membership.team_id, receipt }) });
      event.currentTarget.reset();
      notice(`${receipt.receipt_id} was submitted.`);
      await loadQueue();
    } catch (error) { notice(error.message, true); }
    finally { button.disabled = false; }
  });

  initialize();
})();
