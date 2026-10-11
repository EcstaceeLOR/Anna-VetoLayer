#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const readline = require("node:readline");

const VERSION = "0.1.0";

const MANIFEST = {
  name: "anna-vetolayer-policy-engine",
  display_name: "Anna VetoLayer Policy Engine",
  version: VERSION,
  description:
    "Evaluate a proposed AI-agent action before execution. Hard policy rules run first and return ALLOW, REVIEW, or BLOCK with an auditable receipt.",
  author: "VetoLayer",
  tools: [
    {
      name: "evaluate_action",
      description:
        "Evaluate one proposed agent action before it executes. Use for production changes, money movement, access changes, external communications, data exports, or destructive operations.",
      parameters: [
        { name: "actor", type: "string", description: "Agent or service proposing the action.", required: true },
        { name: "tool", type: "string", description: "Tool or integration that would perform the action.", required: true },
        { name: "operation", type: "string", description: "Operation to perform, such as deploy, refund, invite, or delete.", required: true },
        { name: "target", type: "string", description: "Resource, customer, repository, account, or system affected.", required: true },
        { name: "environment", type: "string", description: "Environment: sandbox, development, staging, or production.", required: true },
        { name: "summary", type: "string", description: "Plain-language explanation of intent and expected impact.", required: true },
        { name: "impact", type: "string", description: "Impact category: code, finance, access, data, communication, or infrastructure.", required: true },
        { name: "amount", type: "number", description: "Financial amount in USD when relevant.", required: false, default: 0 },
        { name: "recipient", type: "string", description: "External recipient or audience when relevant.", required: false, default: "" },
        { name: "evidence", type: "array", description: "Evidence labels or references supporting the action.", required: false, default: [] },
        { name: "permissions", type: "array", description: "Requested permissions or scopes for the action.", required: false, default: [] },
        { name: "rollback_plan", type: "string", description: "How the action can be reversed safely.", required: false, default: "" }
      ]
    }
  ],
  runtime: { type: "node", min_version: "18.0.0" }
};

function normalizeText(value) {
  return String(value || "").trim();
}

function includesAny(text, terms) {
  const haystack = normalizeText(text).toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function createFinding(id, status, severity, summary, source = "deterministic") {
  return { id, status, severity, summary, source };
}

function evaluateAction(raw = {}, now = new Date()) {
  const action = {
    actor: normalizeText(raw.actor) || "Unknown agent",
    tool: normalizeText(raw.tool) || "unknown-tool",
    operation: normalizeText(raw.operation) || "unknown-operation",
    target: normalizeText(raw.target) || "unknown-target",
    environment: normalizeText(raw.environment).toLowerCase() || "unspecified",
    summary: normalizeText(raw.summary),
    impact: normalizeText(raw.impact).toLowerCase() || "unspecified",
    amount: Number.isFinite(Number(raw.amount)) ? Math.max(0, Number(raw.amount)) : 0,
    recipient: normalizeText(raw.recipient),
    evidence: Array.isArray(raw.evidence)
      ? raw.evidence.map(normalizeText).filter(Boolean)
      : normalizeText(raw.evidence)
          .split(/[,\n]/)
          .map((item) => item.trim())
          .filter(Boolean),
    permissions: Array.isArray(raw.permissions)
      ? raw.permissions.map(normalizeText).filter(Boolean)
      : normalizeText(raw.permissions)
          .split(/[,\n]/)
          .map((item) => item.trim())
          .filter(Boolean),
    rollback_plan: normalizeText(raw.rollback_plan)
  };

  const combined = `${action.operation} ${action.target} ${action.summary}`.toLowerCase();
  const findings = [];
  const missingEvidence = [];
  let hardBlock = false;
  let riskScore = 12;

  if (
    includesAny(combined, [
      "exfiltrate secret",
      "export secret",
      "reveal token",
      "dump credential",
      "private key",
      "disable audit",
      "bypass approval"
    ])
  ) {
    hardBlock = true;
    riskScore = 100;
    findings.push(
      createFinding(
        "hard-secret-boundary",
        "fail",
        "critical",
        "The action crosses a protected secret or audit boundary and is explicitly blocked."
      )
    );
  }

  const opensPublicAccess =
    action.impact === "access" &&
    includesAny(combined, ["public", "anyone", "wildcard", "0.0.0.0/0", "anonymous"]);
  if (opensPublicAccess && action.environment === "production") {
    hardBlock = true;
    riskScore = Math.max(riskScore, 96);
    findings.push(
      createFinding(
        "hard-public-production-access",
        "fail",
        "critical",
        "Public or wildcard access to a production resource is explicitly blocked."
      )
    );
  }

  if (action.amount >= 10000) {
    hardBlock = true;
    riskScore = Math.max(riskScore, 94);
    findings.push(
      createFinding(
        "hard-spend-cap",
        "fail",
        "critical",
        "The proposed amount exceeds the single-action safety cap of $10,000."
      )
    );
  } else if (action.amount >= 500) {
    riskScore += action.amount >= 5000 ? 48 : 30;
    findings.push(
      createFinding(
        "review-financial-threshold",
        "uncertain",
        action.amount >= 5000 ? "high" : "medium",
        "The amount crosses the human-review threshold of $500."
      )
    );
  }

  const mutatingOperation = includesAny(action.operation, [
    "deploy",
    "delete",
    "drop",
    "write",
    "merge",
    "refund",
    "send",
    "publish",
    "invite",
    "grant",
    "revoke",
    "rotate",
    "restart",
    "terminate",
    "update"
  ]);

  if (action.environment === "production") {
    riskScore += 25;
    findings.push(
      createFinding(
        "review-production-scope",
        "uncertain",
        "high",
        "The action targets production and requires stronger evidence."
      )
    );
    if (mutatingOperation && !action.rollback_plan) {
      missingEvidence.push("rollback-plan");
      findings.push(
        createFinding(
          "missing-rollback-plan",
          "uncertain",
          "high",
          "A mutating production action needs a rollback plan before it can be allowed."
        )
      );
    }
    if (mutatingOperation && action.evidence.length === 0) {
      missingEvidence.push("verified-change-evidence");
      findings.push(
        createFinding(
          "missing-change-evidence",
          "uncertain",
          "high",
          "A mutating production action needs verified change or approval evidence."
        )
      );
    }
  }

  if (action.recipient && action.impact === "communication") {
    riskScore += 18;
    findings.push(
      createFinding(
        "review-external-communication",
        "uncertain",
        "medium",
        "External communication needs contextual review for audience, claims, and tone."
      )
    );
  }

  if (action.summary.length < 24) {
    riskScore += 15;
    missingEvidence.push("clear-intent");
    findings.push(
      createFinding(
        "missing-clear-intent",
        "uncertain",
        "medium",
        "The stated intent is too brief to evaluate safely."
      )
    );
  }

  if (findings.length === 0) {
    findings.push(
      createFinding(
        "baseline-low-risk",
        "pass",
        "low",
        "No protected boundary or review threshold matched this action."
      )
    );
  }

  riskScore = Math.min(100, riskScore);
  const requiresContext = !hardBlock && findings.some((finding) => finding.status === "uncertain");
  const outcome = hardBlock ? "BLOCK" : requiresContext ? "REVIEW" : "ALLOW";
  const evaluatedAt = now.toISOString();
  const requestId = `req_${crypto.randomUUID()}`;
  const receiptId = `rcpt_${crypto.randomUUID()}`;

  const receipt = {
    schema_version: "1.0",
    receipt_id: receiptId,
    request_id: requestId,
    evaluated_at: evaluatedAt,
    engine_version: VERSION,
    outcome,
    hard_block: hardBlock,
    requires_context: requiresContext,
    can_ai_allow: !hardBlock && missingEvidence.length === 0,
    risk_score: riskScore,
    summary:
      outcome === "BLOCK"
        ? "Blocked by an authoritative deterministic policy."
        : outcome === "REVIEW"
          ? "Held for contextual or human review before execution."
          : "Allowed by the current deterministic policy set.",
    action,
    findings,
    missing_evidence: [...new Set(missingEvidence)]
  };

  receipt.integrity = {
    algorithm: "sha256",
    digest: crypto.createHash("sha256").update(canonicalJson(receipt)).digest("hex")
  };

  return receipt;
}

function invoke(tool, args) {
  if (tool !== "evaluate_action") {
    const error = new Error(`Unknown tool: ${tool}`);
    error.code = -32601;
    throw error;
  }
  return { success: true, data: evaluateAction(args) };
}

function makeResponse(id, payload) {
  return { jsonrpc: "2.0", id, ...payload };
}

function handleRequest(req) {
  if (req.method === "initialize") {
    const protocolVersion = req.params?.protocolVersion || "1.1";
    return makeResponse(req.id, {
      result: {
        protocolVersion,
        serverInfo: { name: MANIFEST.display_name, version: VERSION },
        capabilities: {}
      }
    });
  }
  if (req.method === "describe") return makeResponse(req.id, { result: MANIFEST });
  if (req.method === "health") {
    return makeResponse(req.id, {
      result: { status: "ready", version: VERSION, timestamp: new Date().toISOString() }
    });
  }
  if (req.method === "invoke") {
    return makeResponse(req.id, {
      result: invoke(req.params?.tool, req.params?.arguments || {})
    });
  }
  if (req.method === "shutdown") return makeResponse(req.id, { result: { ok: true } });
  return makeResponse(req.id, {
    error: { code: -32601, message: `Unknown method: ${req.method}` }
  });
}

function start() {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let response;
    try {
      response = handleRequest(JSON.parse(trimmed));
    } catch (error) {
      response = makeResponse(null, {
        error: { code: error.code || -32603, message: error.message || "Internal error" }
      });
    }
    process.stdout.write(`${JSON.stringify(response)}\n`);
  });
}

if (require.main === module) start();

module.exports = { MANIFEST, canonicalJson, evaluateAction, handleRequest, invoke };
