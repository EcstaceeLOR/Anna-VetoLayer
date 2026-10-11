# Release-candidate review checklist

Run this against the exact App version and binary archive submitted to Anna:

1. Run `pnpm validate`, `pnpm test`, `pnpm test:anna`, and `pnpm smoke` from the release commit.
2. In Anna desktop, evaluate one ALLOW, REVIEW, and BLOCK proposal. Confirm a receipt is persisted, and that a BLOCK cannot be approved.
3. Disconnect the Agent or deny the Executa grant. Confirm the app shows a retryable failure and does not issue ALLOW.
4. Deny storage, then evaluate an action. Confirm the receipt is visibly marked unpersisted before export or navigation.
5. Open the app with an `anna-vetolayer.entry-payload.v1` request, update the same request ID, and confirm no evaluation occurs until Run checkpoint is selected.
6. Share a decision card in chat. Confirm it is a transient conversation card, not persisted chat history.
7. Repeat the core evaluation and review flow in Anna mobile portrait and landscape, capturing the Marketplace screenshots.

Record the release commit, App version, Executa artifact hashes, device/runtime version, and screenshots with the submission materials.
