# Anna AI App Builder submission

## Project

**Anna VetoLayer — the pre-flight approval layer for AI agents**

AI agents can call tools, but tool access alone does not answer whether a specific action should execute now. Anna VetoLayer gives agents and their operators a focused checkpoint for production changes, money movement, access updates, data exports, customer communications, and other consequential operations.

## Who it is for

- teams deploying tool-using AI agents;
- developers who need a safety gate before side effects;
- operators responsible for production, financial, data, or access risk;
- reviewers who need evidence and auditability rather than a one-click override.

## The workflow

1. An agent or operator submits a structured action proposal.
2. The bundled `policy-engine` Executa evaluates hard rules, risk thresholds, and evidence requirements.
3. Anna AI is invoked only when contextual interpretation is genuinely needed.
4. Authoritative hard blocks remain blocks; missing critical evidence cannot become an AI allow.
5. Unresolved decisions enter Human Review.
6. Every outcome is saved as an integrity-tagged Decision Receipt.

## Meaningful use of AI

Anna AI is not used as decoration or as the only safety mechanism. Deterministic code owns hard boundaries. `anna.llm.complete` receives the action, policy findings, risk score, and evidence gaps only when the policy engine returns contextual ambiguity. It must return a structured recommendation with confidence, risk flags, and concrete requirements for changing the outcome.

This separation makes the AI valuable where language and context matter while keeping non-negotiable rules deterministic.

## Anna-native integration

| Anna capability | Use in Anna VetoLayer |
| --- | --- |
| Bundled Executa | Runs the deterministic policy engine through `anna.tools.invoke` |
| Host LLM | Performs structured contextual risk analysis with `anna.llm.complete` |
| Persistent Storage | Stores Decision Receipts per user/app with `anna.storage` |
| Chat | Shares a concise verdict back to the active Anna conversation |
| App UI | Provides a responsive evaluation, review, and audit workspace |
| App mention | Adds safety instructions and the policy tool to Anna's active context |

## Judging fit

- **Usefulness and user value:** prevents consequential actions from executing without policy, evidence, and accountable review.
- **Working demo:** includes three instant scenarios, a real stdio tool, strict app validation, tests, and a standalone preview fallback.
- **Meaningful AI:** uses Anna for the ambiguous layer and proves that hard safety rules are not delegated to a model.
- **Anna fit:** combines an App UI, bundled Executa, Host LLM, storage, and chat handoff in one coherent workflow.
- **Creativity and execution:** turns agent governance into a clear pre-flight control path with lineage-preserving receipts.

## Honest scope

Anna VetoLayer evaluates and records decisions. It does not execute the proposed third-party action. That separation is intentional: callers should execute only after receiving `ALLOW`. The first submission uses the Executa's local distribution profile for runnable project review; marketplace publication will require a release distribution profile and Anna developer publication credentials.

## Submission links

- Repository: <https://github.com/EcstaceeLOR/Anna-VetoLayer>
- Hackathon: <https://dorahacks.io/hackathon/2349>
- Anna Developer Hub: <https://anna.partners/developers>
