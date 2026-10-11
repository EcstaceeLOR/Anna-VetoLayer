# Anna VetoLayer

Anna VetoLayer is an AI-native approval checkpoint for consequential agent actions.

It evaluates proposed production changes, financial operations, permission updates, data exports, customer communications, and other high-impact tool calls before execution. Deterministic policy handles hard safety boundaries, Anna AI analyzes genuine ambiguity, Human Review resolves what remains, and every outcome produces an auditable Decision Receipt.

## Control path

1. An agent or operator submits a structured action proposal.
2. The bundled policy Executa evaluates hard rules, thresholds, and evidence.
3. Anna AI performs contextual analysis only when policy needs interpretation.
4. Unresolved actions enter Human Review.
5. The app stores an integrity-tagged Decision Receipt with complete lineage.

Hard deterministic blocks cannot be overruled. Missing critical evidence cannot silently become an AI allow. Anna VetoLayer evaluates and records decisions; it never executes the proposed action.

## Run locally

Prerequisites:

- Node.js 22+
- pnpm 10+
- [`uv`](https://docs.astral.sh/uv/getting-started/installation/) for the Anna local bridge

```bash
pnpm install
pnpm validate
pnpm test
pnpm smoke
pnpm dev
```

Use the deterministic LLM fixture instead of a live Anna model connection:

```bash
pnpm dev:mock
```

## Project structure

```text
.
|-- app.json                        App listing and bundled Executa mapping
|-- manifest.json                   Anna runtime grants and view definition
|-- bundle/                         Responsive Anna App UI
|-- executas/policy-engine/         Deterministic JSON-RPC policy tool
|-- fixtures/                       Mock contextual-analysis response
|-- tests/                          Bundle and manifest contract tests
|-- scripts/smoke-plugin.js         End-to-end stdio smoke test
|-- ARCHITECTURE.md                 Runtime and safety architecture
|-- DEMO.md                         Two-minute demo walkthrough
`-- SUBMISSION.md                   Hackathon submission copy
```

The UI also supports a standalone browser preview. Outside the Anna runtime, it clearly identifies preview mode and uses browser-local receipt storage.

## Anna capabilities

- Bundled Executa through `anna.tools.invoke`
- Contextual AI through `anna.llm.complete`
- Decision Receipt persistence through `anna.storage`
- Conversation handoff through `anna.chat.write_message`
- Responsive desktop and mobile App UI

## Safety invariants

- Deterministic `BLOCK` is authoritative.
- Anna AI is skipped when a hard block matches.
- Anna AI cannot return `ALLOW` while critical evidence is missing.
- Human resolutions create child receipts; prior receipts remain unchanged.
- Evaluation failures never imply permission to execute.

See [ARCHITECTURE.md](ARCHITECTURE.md), [DEMO.md](DEMO.md), and [SUBMISSION.md](SUBMISSION.md).
