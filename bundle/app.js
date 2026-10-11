const EXECUTA_HANDLE = "policy-engine";
const EXECUTA_TOOL_ID =
  window.__ANNA_TOOL_IDS__?.[EXECUTA_HANDLE] || "tool-dev-anna-vetolayer-policy-engine";
const STORAGE_KEY = "receipts/index";
const LOCAL_STORAGE_KEY = "anna-vetolayer-receipts";
const chatArtifact = window.AnnaVetoLayerChat;
const entryPayload = window.AnnaVetoLayerEntryPayload;
const reviewResolution = window.AnnaVetoLayerReviewResolution;
const runtimeError = window.AnnaVetoLayerRuntimeError;
const policyStudio = window.AnnaVetoLayerPolicyStudio;

const $ = (id) => document.getElementById(id);
const state = {
  anna: null,
  runtimeMode: "connecting",
  receipts: [],
  currentReceipt: null,
  receiptFilter: "ALL",
  formDirty: false,
  entryPayloadHash: null,
  deployedRuntime: new URLSearchParams(window.location.search).has("wid"),
  activePolicy: policyStudio?.create("production") || null
};

const scenarios = {
  safe: {
    actor: "Research Agent",
    tool: "notion",
    operation: "read-page",
    target: "Q4 planning notes",
    environment: "development",
    impact: "data",
    summary: "Read the internal planning page to create a draft summary; no records will be changed.",
    amount: 0,
    recipient: "",
    evidence: "Read-only scope verified",
    rollback_plan: ""
  },
  deploy: {
    actor: "Release Agent",
    tool: "github",
    operation: "deploy-production",
    target: "payments-api@v2.4.0",
    environment: "production",
    impact: "code",
    summary: "Deploy the approved release candidate after staging checks passed; rollback readiness still needs confirmation.",
    amount: 0,
    recipient: "",
    evidence: "CI checks passed\nTwo maintainer approvals",
    rollback_plan: ""
  },
  secret: {
    actor: "Debug Agent",
    tool: "vault",
    operation: "export-secret-tokens",
    target: "production credentials",
    environment: "production",
    impact: "data",
    summary: "Export secret tokens to an external debugging endpoint to reproduce an authentication issue.",
    amount: 0,
    recipient: "external-debug.example",
    evidence: "Incident ticket INC-204",
    rollback_plan: "Delete the exported file after debugging"
  }
};

const pageMeta = {
  evaluate: ["DECISION CHECKPOINT", "Evaluate an action"],
  reviews: ["HUMAN IN THE LOOP", "Review queue"],
  receipts: ["AUDITABLE BY DEFAULT", "Decision receipts"],
  policies: ["VERSIONED CONTROLS", "Policy Studio"]
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function uid(prefix) {
  const value = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${value}`;
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function setRuntimeStatus(mode, label, detail) {
  state.runtimeMode = mode;
  $("runtime-label").textContent = label;
  $("runtime-detail").textContent = detail;
  $("runtime-dot").className = `status-dot ${mode === "live" ? "is-live" : "is-preview"}`;
}

async function connectAnna() {
  try {
    const { AnnaAppRuntime } = await import("/static/anna-apps/_sdk/latest/index.js");
    state.anna = await AnnaAppRuntime.connect();
    await state.anna.window?.set_title?.({ title: "Anna VetoLayer" }).catch(() => undefined);
    const tools = await state.anna.tools.list({});
    const tool = tools.tools?.find((item) => item.tool_id === EXECUTA_TOOL_ID);
    const detail = tool?.status === "deploying" ? "Policy tool is deploying" : "Policy tool + Anna AI ready";
    setRuntimeStatus("live", "Connected to Anna", detail);
    applyEntryPayload(state.anna.entryPayload, "launch");
    state.anna.on?.("entry_payload", (payload) => applyEntryPayload(payload, "updated request"));
  } catch (error) {
    console.warn("Anna runtime connection failed.", runtimeError?.code(error));
    state.anna = null;
    if (state.deployedRuntime) {
      setRuntimeStatus("error", "Anna connection failed", "No decision can be issued until the runtime reconnects");
    } else {
      setRuntimeStatus("preview", "Standalone preview", "Local policy + browser storage");
    }
  }
}

async function loadReceipts() {
  if (state.anna?.storage) {
    try {
      const stored = await state.anna.storage.get({ key: STORAGE_KEY });
      state.receipts = stored.exists && Array.isArray(stored.value) ? stored.value : [];
      return;
    } catch (error) {
      console.warn("Anna storage read failed.", runtimeError?.code(error));
      if (state.deployedRuntime) {
        state.receipts = [];
        showToast("Stored receipts are unavailable in Anna right now.");
        return;
      }
    }
  }
  try {
    state.receipts = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
    if (!Array.isArray(state.receipts)) state.receipts = [];
  } catch {
    state.receipts = [];
  }
}

async function saveReceipts() {
  state.receipts = state.receipts.slice(0, 100);
  if (state.anna?.storage) {
    try {
      await state.anna.storage.set({
        key: STORAGE_KEY,
        value: state.receipts,
        metadata: { product: "anna-vetolayer", schema: "1.0" },
        tags: ["decision-receipts"]
      });
      return true;
    } catch (error) {
      console.warn("Anna storage write failed.", runtimeError?.code(error));
      if (state.deployedRuntime) return false;
    }
  }
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.receipts));
    return true;
  } catch {
    return false;
  }
}

function switchView(view) {
  document.querySelectorAll(".view").forEach((element) => {
    element.classList.toggle("is-visible", element.id === `view-${view}`);
  });
  document.querySelectorAll(".nav-item").forEach((element) => {
    element.classList.toggle("is-active", element.dataset.view === view);
  });
  $("page-kicker").textContent = pageMeta[view][0];
  $("page-title").textContent = pageMeta[view][1];
  if (view === "reviews") renderReviews();
  if (view === "receipts") renderReceipts();
}

function populateScenario(name) {
  const scenario = scenarios[name];
  const form = $("action-form");
  Object.entries(scenario).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value;
  });
  document.querySelectorAll(".demo-chip").forEach((element) => {
    element.classList.toggle("is-selected", element.dataset.scenario === name);
  });
  state.formDirty = true;
}

function applyEntryPayload(rawPayload, source) {
  if (!rawPayload || !entryPayload) return false;
  const parsed = entryPayload.parse(rawPayload);
  if (!parsed.ok) {
    showToast(`Anna request needs attention: ${parsed.errors.join(" ")}`);
    return false;
  }
  if (parsed.fingerprint === state.entryPayloadHash) return false;
  if (state.formDirty && !window.confirm("Replace your unsaved edits with the updated Anna request?")) {
    showToast("Your unsaved edits were kept.");
    return false;
  }

  const form = $("action-form");
  const action = parsed.value.action;
  for (const [key, value] of Object.entries(action)) {
    if (!form.elements[key]) continue;
    form.elements[key].value = Array.isArray(value) ? value.join("\n") : String(value ?? "");
  }
  state.entryPayloadHash = parsed.fingerprint;
  state.formDirty = false;
  const requestLabel = parsed.value.request_id ? `Request ${parsed.value.request_id}` : "Anna request";
  $("entry-payload-status").textContent = `${requestLabel} prefilled from ${source}. Review the proposal before running the checkpoint.`;
  $("entry-payload-status").hidden = false;
  switchView("evaluate");
  showToast("Anna request prefilled. Review it before evaluation.");
  return true;
}

function formPayload(form) {
  const data = new FormData(form);
  return {
    actor: String(data.get("actor") || "").trim(),
    tool: String(data.get("tool") || "").trim(),
    operation: String(data.get("operation") || "").trim(),
    target: String(data.get("target") || "").trim(),
    environment: String(data.get("environment") || "").trim(),
    impact: String(data.get("impact") || "").trim(),
    summary: String(data.get("summary") || "").trim(),
    amount: Number(data.get("amount") || 0),
    recipient: String(data.get("recipient") || "").trim(),
    evidence: String(data.get("evidence") || "")
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean),
    permissions: String(data.get("permissions") || "")
      .split(/[\,\n]/)
      .map((item) => item.trim())
      .filter(Boolean),
    rollback_plan: String(data.get("rollback_plan") || "").trim()
  };
}

function finding(id, status, severity, summary) {
  return { id, status, severity, summary, source: "deterministic" };
}

function localPolicyEvaluation(action) {
  const combined = `${action.operation} ${action.target} ${action.summary}`.toLowerCase();
  const findings = [];
  const missing = [];
  let hardBlock = false;
  let risk = 12;

  if (["export secret", "reveal token", "dump credential", "private key", "bypass approval", "disable audit"].some((term) => combined.includes(term))) {
    hardBlock = true;
    risk = 100;
    findings.push(finding("hard-secret-boundary", "fail", "critical", "Protected secrets and approval boundaries cannot be exported or bypassed."));
  }
  if (action.impact === "access" && action.environment === "production" && ["public", "anyone", "wildcard", "0.0.0.0/0"].some((term) => combined.includes(term))) {
    hardBlock = true;
    risk = Math.max(risk, 96);
    findings.push(finding("hard-public-production-access", "fail", "critical", "Public or wildcard production access is explicitly blocked."));
  }
  if (action.amount >= 10000) {
    hardBlock = true;
    risk = Math.max(risk, 94);
    findings.push(finding("hard-spend-cap", "fail", "critical", "The amount exceeds the $10,000 single-action cap."));
  } else if (action.amount >= 500) {
    risk += action.amount >= 5000 ? 48 : 30;
    findings.push(finding("review-financial-threshold", "uncertain", "high", "The amount crosses the $500 human-review threshold."));
  }

  const mutating = ["deploy", "delete", "drop", "write", "merge", "refund", "send", "publish", "invite", "grant", "revoke", "rotate", "terminate", "update"].some((term) => action.operation.toLowerCase().includes(term));
  if (action.environment === "production") {
    risk += 25;
    findings.push(finding("review-production-scope", "uncertain", "high", "Production scope requires stronger evidence and contextual review."));
    if (mutating && !action.rollback_plan) {
      missing.push("rollback-plan");
      findings.push(finding("missing-rollback-plan", "uncertain", "high", "A mutating production action needs a rollback plan."));
    }
    if (mutating && action.evidence.length === 0) {
      missing.push("verified-change-evidence");
      findings.push(finding("missing-change-evidence", "uncertain", "high", "Verified change or approval evidence is required."));
    }
  }
  if (action.recipient && action.impact === "communication") {
    risk += 18;
    findings.push(finding("review-external-communication", "uncertain", "medium", "External communication needs contextual review."));
  }
  if (action.summary.length < 24) {
    risk += 15;
    missing.push("clear-intent");
    findings.push(finding("missing-clear-intent", "uncertain", "medium", "The stated intent is too brief to evaluate safely."));
  }
  if (findings.length === 0) findings.push(finding("baseline-low-risk", "pass", "low", "No protected boundary or review threshold matched."));

  const requiresContext = !hardBlock && findings.some((item) => item.status === "uncertain");
  const outcome = hardBlock ? "BLOCK" : requiresContext ? "REVIEW" : "ALLOW";
  return {
    schema_version: "1.0",
    receipt_id: uid("rcpt"),
    request_id: uid("req"),
    evaluated_at: new Date().toISOString(),
    engine_version: "preview-0.1.0",
    policy_version: state.activePolicy?.revision ? `${state.activePolicy.policy_id}@${state.activePolicy.revision}` : "core@1",
    outcome,
    hard_block: hardBlock,
    requires_context: requiresContext,
    can_ai_allow: !hardBlock && missing.length === 0,
    risk_score: Math.min(100, risk),
    summary: outcome === "BLOCK" ? "Blocked by an authoritative deterministic policy." : outcome === "REVIEW" ? "Held for contextual or human review before execution." : "Allowed by the current deterministic policy set.",
    action,
    findings,
    missing_evidence: [...new Set(missing)],
    integrity: { algorithm: "sha256", digest: "preview-generated" }
  };
}

function normalizePolicyResult(raw) {
  if (raw?.receipt_id) return raw;
  if (raw?.data?.receipt_id) return raw.data;
  if (raw?.data?.data?.receipt_id) return raw.data.data;
  throw new Error("The policy tool returned an unexpected response shape.");
}

async function runPolicy(action) {
  if (!state.anna?.tools) {
    if (state.runtimeMode === "preview") return localPolicyEvaluation(action);
    const error = new Error("Anna policy runtime is unavailable.");
    error.code = "agent_unavailable";
    throw error;
  }
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await state.anna.tools.invoke({ tool_id: EXECUTA_TOOL_ID, method: "evaluate_action", args: { ...action, policy: state.activePolicy }, timeoutMs: 15000 });
      return normalizePolicyResult(raw);
    } catch (error) {
      lastError = error;
      if (!runtimeError?.describe(error).retryable || attempt === 1) throw error;
    }
  }
  throw lastError;
}

function parseJsonText(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Anna did not return structured JSON.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function runContextualReview(policy) {
  if (!state.anna?.llm) {
    if (state.runtimeMode !== "preview") {
      return { outcome: "REVIEW", confidence: 0, summary: "Contextual analysis is unavailable; human review is required.", risk_flags: ["contextual-analysis-unavailable"], requirements: ["Restore Anna contextual analysis before approving"], model: "unavailable" };
    }
    return {
      outcome: "REVIEW",
      confidence: 0.78,
      summary: "The action has plausible intent, but a human should verify the remaining evidence before execution.",
      risk_flags: policy.missing_evidence.length ? policy.missing_evidence : ["context requires confirmation"],
      requirements: policy.missing_evidence.map((item) => `Provide ${item.replaceAll("-", " ")}`),
      model: "standalone-preview"
    };
  }

  const prompt = {
    action: policy.action,
    deterministic_outcome: policy.outcome,
    hard_block: policy.hard_block,
    can_ai_allow: policy.can_ai_allow,
    risk_score: policy.risk_score,
    findings: policy.findings,
    missing_evidence: policy.missing_evidence
  };
  const response = await state.anna.llm.complete(
    {
      messages: [
        {
          role: "user",
          content: `Evaluate this agent action using only the supplied facts. Return strict JSON with keys outcome (ALLOW, REVIEW, or BLOCK), confidence (0 to 1), summary, risk_flags (array), and requirements (array). If can_ai_allow is false, you must not return ALLOW. Do not claim the action executed.\n\n${JSON.stringify(prompt)}`
        }
      ],
      systemPrompt: "You are VetoLayer's contextual risk analyst inside Anna. Deterministic hard blocks are authoritative. Missing critical evidence always remains REVIEW or BLOCK. Be concise, skeptical, and explicit about what would change the decision.",
      maxTokens: 650,
      temperature: 0.1,
      metadata: { workflow: "anna-vetolayer-context-review", request_id: policy.request_id }
    },
    { timeoutMs: 60000 }
  );
  let result;
  try {
    result = parseJsonText(response.content?.text);
  } catch (error) {
    return { outcome: "REVIEW", confidence: 0, summary: "Contextual analysis returned invalid data; human review is required.", risk_flags: ["malformed-llm-output"], requirements: ["Restore contextual analysis before approving"], model: "unavailable" };
  }
  result.model = response.model || "Anna AI";
  return result;
}

async function digestReceipt(receipt) {
  if (!globalThis.crypto?.subtle) return "unavailable";
  const clone = structuredClone(receipt);
  delete clone.integrity;
  const bytes = new TextEncoder().encode(JSON.stringify(clone));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sanitizeOutcome(outcome, fallback = "REVIEW") {
  const value = String(outcome || "").toUpperCase();
  return ["ALLOW", "REVIEW", "BLOCK"].includes(value) ? value : fallback;
}

async function finalizeReceipt(policy, context) {
  let outcome = policy.outcome;
  if (policy.hard_block) {
    outcome = "BLOCK";
  } else if (context) {
    outcome = sanitizeOutcome(context.outcome, "REVIEW");
    if (!policy.can_ai_allow && outcome === "ALLOW") outcome = "REVIEW";
  }

  const receipt = {
    ...policy,
    outcome,
    decided_at: new Date().toISOString(),
    contextual_analysis: context
      ? {
          outcome,
          confidence: Math.max(0, Math.min(1, Number(context.confidence) || 0)),
          summary: String(context.summary || "Contextual review completed."),
          risk_flags: Array.isArray(context.risk_flags) ? context.risk_flags.slice(0, 6) : [],
          requirements: Array.isArray(context.requirements) ? context.requirements.slice(0, 6) : [],
          model: context.model || "Anna AI"
        }
      : null,
    integrity: { algorithm: "sha256", digest: "pending" }
  };
  receipt.integrity.digest = await digestReceipt(receipt);
  return receipt;
}

function setProgress(stage, title, copy) {
  const order = ["policy", "context", "receipt"];
  const index = order.indexOf(stage);
  $("progress-title").textContent = title;
  $("progress-copy").textContent = copy;
  $("progress-bar").style.width = `${[22, 62, 100][index]}%`;
  order.forEach((name, itemIndex) => {
    const element = $(`stage-${name}`);
    element.classList.toggle("is-active", itemIndex === index);
    element.classList.toggle("is-done", itemIndex < index);
  });
}

function showProgress() {
  $("decision-empty").hidden = true;
  $("decision-result").hidden = true;
  $("decision-progress").hidden = false;
  setProgress("policy", "Running deterministic policy", "Checking protected boundaries, thresholds, and evidence requirements.");
}

function renderDecision(receipt) {
  state.currentReceipt = receipt;
  $("decision-progress").hidden = true;
  $("decision-empty").hidden = true;
  $("decision-result").hidden = false;
  const verdict = $("verdict");
  verdict.textContent = receipt.outcome;
  verdict.className = `verdict ${receipt.outcome.toLowerCase()}`;
  $("risk-score").textContent = `Risk ${receipt.risk_score}/100`;
  $("result-summary").textContent = receipt.outcome === "ALLOW" ? "Action may proceed." : receipt.outcome === "BLOCK" ? "Action must not execute." : "Human review required.";
  const persistenceNote = receipt.persistence === "unpersisted" ? " This receipt could not be saved to Anna; export it before leaving." : "";
  $("result-context").textContent = `${receipt.contextual_analysis?.summary || receipt.summary}${persistenceNote}`;
  $("receipt-id").textContent = receipt.receipt_id;

  const allFindings = [
    ...receipt.findings,
    ...(receipt.contextual_analysis?.requirements || []).map((item, index) => ({
      id: `context-requirement-${index + 1}`,
      status: "uncertain",
      severity: "medium",
      summary: item,
      source: "Anna context"
    }))
  ].slice(0, 6);
  $("finding-list").innerHTML = allFindings
    .map(
      (item) => `
        <div class="finding ${escapeHtml(item.status)}">
          <i></i>
          <div>
            <strong>${escapeHtml(item.severity.toUpperCase())} · ${escapeHtml(item.source || "policy")}</strong>
            <span>${escapeHtml(item.summary)}</span>
          </div>
        </div>`
    )
    .join("");
}

async function evaluate(event) {
  event.preventDefault();
  const button = $("evaluate-button");
  if (!event.currentTarget.reportValidity()) return;
  button.disabled = true;
  showProgress();
  try {
    const action = formPayload(event.currentTarget);
    const policy = await runPolicy(action);
    let context = null;
    if (policy.requires_context && !policy.hard_block) {
      setProgress("context", "Asking Anna for context", "Interpreting intent, impact, and ambiguity without weakening hard policy.");
      context = await runContextualReview(policy);
    } else {
      setProgress("context", policy.hard_block ? "Hard boundary matched" : "No ambiguity detected", policy.hard_block ? "Contextual AI is skipped because deterministic BLOCK is authoritative." : "The deterministic policy is sufficient for this proposal.");
    }
    setProgress("receipt", "Sealing decision receipt", "Recording inputs, findings, lineage, and integrity metadata.");
    const receipt = await finalizeReceipt(policy, context);
    receipt.persistence = "pending";
    state.receipts.unshift(receipt);
    const persisted = await saveReceipts();
    receipt.persistence = persisted ? "persisted" : "unpersisted";
    await new Promise((resolve) => setTimeout(resolve, 280));
    renderDecision(receipt);
    renderCounts();
    showToast(persisted ? `${receipt.outcome} receipt created` : `${receipt.outcome} receipt created but not persisted. Export it before leaving.`);
  } catch (error) {
    console.error(error);
    state.anna?.window?.report_error?.({ message: "Anna VetoLayer evaluation failed", context: { code: runtimeError?.code(error) || "internal_error" } }).catch(() => undefined);
    $("decision-progress").hidden = true;
    $("decision-empty").hidden = false;
    const details = runtimeError?.describe(error) || { message: "No decision was issued. Retry when Anna is available." };
    showToast(details.message);
  } finally {
    button.disabled = false;
  }
}

function unresolvedReviews() {
  const resolvedParents = new Set(state.receipts.filter((item) => item.parent_receipt_id).map((item) => item.parent_receipt_id));
  return state.receipts.filter((item) => item.outcome === "REVIEW" && !item.parent_receipt_id && !resolvedParents.has(item.receipt_id));
}

function renderCounts() {
  const count = unresolvedReviews().length;
  $("review-count").textContent = String(count);
  $("queue-total").textContent = `${count} open`;
}

function renderReviews() {
  const reviews = unresolvedReviews();
  renderCounts();
  if (!reviews.length) {
    $("review-list").innerHTML = '<div class="empty-state">No unresolved actions. New REVIEW decisions will appear here.</div>';
    return;
  }
  $("review-list").innerHTML = reviews.map((receipt) => {
    const requirements = receipt.missing_evidence || [];
    const highRisk = reviewResolution?.needsHighRiskAcknowledgement(receipt);
    const fields = requirements.map((requirement) => `<label><span>${escapeHtml(requirement.replaceAll("-", " "))}</span><textarea class="review-evidence" data-requirement="${escapeHtml(requirement)}" aria-label="Evidence for ${escapeHtml(requirement)}" placeholder="Provide the evidence or updated action detail that resolves this requirement."></textarea></label>`).join("");
    return `
      <article class="review-card" data-receipt-id="${escapeHtml(receipt.receipt_id)}">
        <div>
          <span class="eyebrow">${escapeHtml(receipt.action.environment)} · RISK ${escapeHtml(receipt.risk_score)}</span>
          <h3>${escapeHtml(receipt.action.operation)} → ${escapeHtml(receipt.action.target)}</h3>
          <p>${escapeHtml(receipt.contextual_analysis?.summary || receipt.summary)}</p>
          <div class="review-meta">
            <span>Actor: ${escapeHtml(receipt.action.actor)}</span>
            <span>Tool: ${escapeHtml(receipt.action.tool)}</span>
            <span>${escapeHtml(requirements.length)} evidence gap${requirements.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div class="review-controls">
          <p class="review-help">Approval requires a rationale, evidence for every open requirement, and a fresh deterministic policy check. A hard BLOCK cannot be approved.</p>
          <div class="review-requirements">${fields}</div>
          <textarea class="review-rationale" aria-label="Reviewer rationale" placeholder="Explain why this resolution is safe and justified."></textarea>
          ${highRisk ? '<label class="review-ack"><input class="review-high-risk-ack" type="checkbox" /> <span>I acknowledge this is a high-risk action and that the structured evidence above was reviewed.</span></label>' : ""}
          <div class="review-actions">
            <button class="review-action approve" type="button" data-resolution="ALLOW">Approve after re-check</button>
            <button class="review-action block" type="button" data-resolution="BLOCK">Block action</button>
            <button class="review-action request-changes" type="button" data-resolution="REQUEST_CHANGES">Keep open for request changes</button>
          </div>
        </div>
      </article>`;
  }).join("");
}

async function resolveReview(card, resolution) {
  const parent = state.receipts.find((item) => item.receipt_id === card.dataset.receiptId);
  if (!parent) return;
  if (reviewResolution.alreadyResolved(state.receipts, parent.receipt_id)) {
    showToast("This review was already resolved. Refresh the queue.");
    renderReviews();
    return;
  }
  if (resolution === "REQUEST_CHANGES") {
    showToast("Review remains open. Update the request and submit it again when ready.");
    return;
  }
  if (!reviewResolution) {
    showToast("Structured review controls are unavailable in this runtime.");
    return;
  }
  const review = {
    rationale: card.querySelector(".review-rationale").value,
    evidence: Object.fromEntries([...card.querySelectorAll(".review-evidence")].map((input) => [input.dataset.requirement, input.value])),
    acknowledged_high_risk: Boolean(card.querySelector(".review-high-risk-ack")?.checked)
  };
  const checked = reviewResolution.validate(parent, resolution, review);
  if (!checked.ok) {
    showToast(checked.errors[0]);
    card.querySelector(".review-rationale, .review-evidence, .review-high-risk-ack")?.focus();
    return;
  }

  let reevaluation = null;
  let action = parent.action;
  if (resolution === "ALLOW") {
    action = reviewResolution.applyEvidence(parent.action, checked.value.evidence);
    try {
      reevaluation = await runPolicy(action);
    } catch (error) {
      showToast(`Policy re-check failed: ${error.message || error}`);
      return;
    }
    if (reevaluation.hard_block) {
      showToast("Approval is unavailable: the policy re-check produced an authoritative BLOCK.");
      return;
    }
  }
  const child = {
    ...parent,
    receipt_id: uid("rcpt"),
    parent_receipt_id: parent.receipt_id,
    outcome: resolution,
    decided_at: new Date().toISOString(),
    action,
    findings: reevaluation?.findings || parent.findings,
    missing_evidence: reevaluation?.missing_evidence || [],
    hard_block: reevaluation?.hard_block || false,
    requires_context: reevaluation?.requires_context || false,
    policy_re_evaluation: reevaluation ? { receipt_id: reevaluation.receipt_id, engine_version: reevaluation.engine_version, outcome: reevaluation.outcome, hard_block: reevaluation.hard_block, evaluated_at: reevaluation.evaluated_at } : null,
    human_resolution: { outcome: resolution, rationale: checked.value.rationale, evidence: checked.value.evidence, acknowledged_high_risk: checked.value.acknowledged_high_risk, reviewer: "current-user", resolved_at: new Date().toISOString() },
    summary: resolution === "ALLOW" ? "A human reviewer supplied structured evidence and approved after policy re-evaluation." : "A human reviewer blocked the action.",
    integrity: { algorithm: "sha256", digest: "pending" }
  };
  child.integrity.digest = await digestReceipt(child);
  child.persistence = "pending";
  state.receipts.unshift(child);
  child.persistence = (await saveReceipts()) ? "persisted" : "unpersisted";
  renderReviews();
  showToast(`Review resolved as ${resolution}`);
}

function renderReceipts() {
  const filtered = state.receiptFilter === "ALL" ? state.receipts : state.receipts.filter((item) => item.outcome === state.receiptFilter);
  $("receipts-empty").hidden = filtered.length > 0;
  $("receipt-rows").innerHTML = filtered
    .map((receipt) => {
      const date = new Date(receipt.decided_at || receipt.evaluated_at);
      return `
        <tr>
          <td><span class="table-verdict ${escapeHtml(receipt.outcome.toLowerCase())}">${escapeHtml(receipt.outcome)}</span></td>
          <td>${escapeHtml(receipt.action.operation)} · ${escapeHtml(receipt.action.target)}</td>
          <td>${escapeHtml(receipt.action.actor)}</td>
          <td>${escapeHtml(receipt.risk_score)}/100</td>
          <td>${escapeHtml(date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }))}</td>
          <td><span class="receipt-code" title="${escapeHtml(receipt.receipt_id)}">${escapeHtml(receipt.receipt_id.slice(0, 15))}…</span></td>
        </tr>`;
    })
    .join("");
}

async function sendCurrentToChat() {
  const receipt = state.currentReceipt;
  if (!receipt) return;
  const button = $("send-to-chat");
  if (!state.anna?.chat?.append_artifact || !chatArtifact) {
    showToast("Conversation handoff is unavailable in this runtime.");
    return;
  }
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Sharing…";
  try {
    const response = await state.anna.chat.append_artifact({
      artifact: chatArtifact.createReceiptArtifact(receipt)
    });
    if (!response?.artifact_id) throw new Error("Anna did not confirm the conversation card.");
    showToast("Transient decision card added to this conversation.");
  } catch (error) {
    console.warn("Conversation artifact handoff failed.", error);
    showToast(chatArtifact.describeHandoffError(error));
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function exportCurrentReceipt() {
  if (!state.currentReceipt) return;
  const blob = new Blob([JSON.stringify(state.currentReceipt, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.currentReceipt.receipt_id}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function clearData() {
  if (!confirm("Clear all Anna VetoLayer demo receipts in this app?")) return;
  state.receipts = [];
  state.currentReceipt = null;
  if (state.anna?.storage) {
    try {
      await state.anna.storage.delete({ key: STORAGE_KEY });
    } catch (error) {
      if (!String(error?.message || error).includes("not_found")) console.warn(error);
    }
  }
  localStorage.removeItem(LOCAL_STORAGE_KEY);
  $("decision-result").hidden = true;
  $("decision-progress").hidden = true;
  $("decision-empty").hidden = false;
  renderCounts();
  renderReviews();
  renderReceipts();
  showToast("Demo receipts cleared.");
}

function bindEvents() {
  document.querySelectorAll(".nav-item").forEach((element) => {
    element.addEventListener("click", () => switchView(element.dataset.view));
  });
  document.querySelectorAll(".demo-chip").forEach((element) => {
    element.addEventListener("click", () => populateScenario(element.dataset.scenario));
  });
  $("action-form").addEventListener("input", () => {
    state.formDirty = true;
  });
  document.querySelectorAll(".filter-button").forEach((element) => {
    element.addEventListener("click", () => {
      state.receiptFilter = element.dataset.filter;
      document.querySelectorAll(".filter-button").forEach((button) => button.classList.toggle("is-active", button === element));
      renderReceipts();
    });
  });
  $("action-form").addEventListener("submit", evaluate);
  $("review-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-resolution]");
    const card = event.target.closest(".review-card");
    if (button && card) resolveReview(card, button.dataset.resolution);
  });
  $("copy-receipt").addEventListener("click", async () => {
    await navigator.clipboard.writeText(state.currentReceipt?.receipt_id || "");
    showToast("Receipt ID copied.");
  });
  $("send-to-chat").addEventListener("click", sendCurrentToChat);
  $("export-receipt").addEventListener("click", exportCurrentReceipt);
  $("clear-data").addEventListener("click", clearData);
  $("policy-template").addEventListener("change", (event) => {
    const next = policyStudio.create(event.target.value, (state.activePolicy?.revision || 0) + 1);
    $("policy-name").value = next.name;
    $("policy-json").value = JSON.stringify(next, null, 2);
  });
  $("simulate-policy").addEventListener("click", () => {
    try {
      const candidate = JSON.parse($("policy-json").value);
      const checked = policyStudio.validate(candidate);
      $("policy-result").textContent = checked.ok ? `Simulation valid — no receipt created. Changes: ${JSON.stringify(policyStudio.diff(state.activePolicy, candidate))}` : checked.errors.join(" ");
    } catch { $("policy-result").textContent = "Simulation failed: policy JSON is invalid."; }
  });
  $("activate-policy").addEventListener("click", async () => {
    try {
      const candidate = JSON.parse($("policy-json").value);
      const activated = policyStudio.activate(candidate, state.activePolicy);
      if (!activated.ok) { $("policy-result").textContent = activated.errors.join(" "); return; }
      state.activePolicy = activated.value;
      if (state.anna?.storage) await state.anna.storage.set({ key: "policies/active", value: state.activePolicy, metadata: { schema: policyStudio.VERSION }, tags: ["active-policy"] });
      $("policy-result").textContent = `Activated ${state.activePolicy.policy_id}@${state.activePolicy.revision}. Diff: ${JSON.stringify(state.activePolicy.changes)}`;
    } catch (error) { $("policy-result").textContent = `Activation failed: ${error.message || "invalid policy"}`; }
  });
}

async function init() {
  bindEvents();
  await connectAnna();
  await loadReceipts();
  renderCounts();
  renderReviews();
  renderReceipts();
  if (policyStudio) {
    $("policy-name").value = state.activePolicy.name;
    $("policy-json").value = JSON.stringify(state.activePolicy, null, 2);
  }
}

init();
