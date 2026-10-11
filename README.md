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
pnpm test:anna
pnpm smoke
pnpm dev
```

Use the deterministic LLM fixture instead of a live Anna model connection:

```bash
pnpm dev:mock
```

`pnpm test:anna` uses Anna's official in-process bundle harness. It verifies the ACL-gated policy, LLM, APS, chat-artifact, and entry-payload surfaces without requiring a running iframe. The release checklist still requires the exact release candidate to be exercised in Anna desktop and mobile before Marketplace submission.

## Production Executa releases

The policy engine is shipped as a Node single-executable application, so Marketplace users do not need a local Node or Python installation. The release workflow builds and smoke-tests native artifacts for macOS on Intel and Apple Silicon, Linux x86_64, and Windows x86_64.

To build and verify the artifact for the current machine:

```bash
pnpm install
pnpm release:executa
```

The command creates a platform archive and SHA-256 sidecar in `executas/policy-engine/dist/`, extracts it into a clean directory, then proves `describe`, `health`, and `evaluate_action` all work from the packaged binary. Release artifacts are intentionally untracked.

GitHub Actions runs the complete native matrix for every pull request and publishes all four archives to a GitHub Release when a `v*` tag is pushed. Anna's binary profile uses direct uploads through `anna-app apps cut`, which freezes the archive hashes with the App version. Before the first binary upload, mint the production Executa ID and configure the bundled Executa in the Anna Developer Console; never replace the minted ID manually.

For zero-secret binary upload, register the release workflow as an Anna trusted publisher and use the CLI's OIDC binary-upload flow. App lifecycle commands such as `apps cut`, `submit-review`, and `release` still require the maintainer's Anna credentials. To roll back, cut and release a new App version pinned to the previous verified Executa version rather than overwriting an existing binary.

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
- Conversation handoff through transient Anna chat artifacts (not conversation history or LLM context)
- Responsive desktop and mobile App UI

## Safety invariants

- Deterministic `BLOCK` is authoritative.
- Anna AI is skipped when a hard block matches.
- Anna AI cannot return `ALLOW` while critical evidence is missing.
- Human resolutions create child receipts; prior receipts remain unchanged.
- Evaluation failures never imply permission to execute.

See [ARCHITECTURE.md](ARCHITECTURE.md), [DEMO.md](DEMO.md), and [SUBMISSION.md](SUBMISSION.md).
See [docs/entry-payload.md](docs/entry-payload.md) for the versioned Anna launch and update payload.
Use [docs/release-review-checklist.md](docs/release-review-checklist.md) against the exact Marketplace release candidate.
See [docs/marketplace-listing.md](docs/marketplace-listing.md) and [docs/release-runbook.md](docs/release-runbook.md) for the listing and account-bound release steps.
See [docs/growth-launch-checklist.md](docs/growth-launch-checklist.md) for qualified-run outreach and recovery guidance.
See [docs/receipt-integrity.md](docs/receipt-integrity.md) for canonical receipt verification and lineage semantics.
