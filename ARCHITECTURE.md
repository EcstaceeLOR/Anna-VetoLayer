# Anna VetoLayer architecture

```text
Agent or operator
       │
       ▼
Anna App UI ───────────────► bundled policy-engine Executa
       │                     hard rules · thresholds · evidence
       │                                  │
       │                                  ▼
       │                         ALLOW / REVIEW / BLOCK
       │                                  │
       ├── contextual ambiguity? ─────────┘
       │          │
       │          ▼
       │   anna.llm.complete
       │   structured risk analysis
       │          │
       ▼          ▼
Outcome safety floor
       │
       ├── REVIEW ──► Human Review ──► child receipt
       │
       ▼
anna.storage ──► immutable-style receipt lineage
       │
       ├──► Anna chat summary
       └──► JSON export
```

## Boundary ownership

The bundled Executa owns deterministic safety decisions. It evaluates normalized action inputs against protected boundaries, environment and impact scope, financial thresholds, operation type, evidence, and rollback readiness.

Anna's LLM owns contextual analysis, not hard policy. The UI passes the deterministic result into a constrained prompt and validates the returned outcome. If `can_ai_allow` is false, an AI `ALLOW` is clamped back to `REVIEW`.

Human review owns accountable resolution. A reviewer must provide a rationale or evidence note. Resolution creates a new receipt with `parent_receipt_id`; it does not mutate the earlier decision.

## Failure behavior

- Executa errors produce no decision and no implied allow.
- Malformed Anna LLM output produces no silent allow.
- Missing critical evidence imposes a `REVIEW` floor.
- Hard deterministic findings impose a `BLOCK` floor.
- The UI never executes the proposed action.

## Core guarantees

- Action, actor, evidence, and environment are captured before evaluation.
- Deterministic policy always runs before contextual analysis.
- Every verdict is one of `ALLOW`, `REVIEW`, or `BLOCK`.
- Provider and parsing failures fail closed.
- Human Review preserves receipt lineage instead of overwriting history.
- Every completed evaluation produces a Decision Receipt.
