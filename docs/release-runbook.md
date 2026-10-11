# Anna release runbook

## Before account-bound steps

1. Run `corepack pnpm release:preflight` from the intended release commit.
2. Complete `docs/marketplace-listing.md`, including the public privacy-policy URL and release-candidate screenshots.
3. Confirm `app.json` version is the intended immutable release version; never reuse an already cut version.
4. Keep PATs, DoraHacks credentials, and uploaded asset tokens outside this repository.

## Anna lifecycle

The CLI is installed locally through pnpm. Authenticate interactively; do not paste a PAT into source files or CI logs.

```powershell
corepack pnpm exec anna-app login --host <anna-nexus-host>
corepack pnpm exec anna-app whoami
corepack pnpm exec anna-app apps push
corepack pnpm exec anna-app apps cut 0.1.0
corepack pnpm exec anna-app apps status anna-vetolayer
corepack pnpm exec anna-app apps submit-review anna-vetolayer
```

At submit time, verify that the version is the review candidate and the precheck reports a finalized (`bundle_ready`) bundle with frozen Executa bindings. Admin approval is asynchronous. Do not cut or submit a different version unless deliberately switching the review candidate.

After the status becomes `APPROVED`:

```powershell
corepack pnpm exec anna-app apps release 0.1.0
corepack pnpm exec anna-app apps status anna-vetolayer
```

Confirm status is `PUBLISHED`, install the live app, and complete `docs/release-review-checklist.md` against the published version. Record the public Anna App URL.

## DoraHacks

Use the published Anna App URL—not the repository or preview URL—in the DoraHacks submission. Add the project description from `SUBMISSION.md`, link this repository, and attach release-candidate screenshots. Save the submitted DoraHacks project URL in the issue and release notes.

## Rejection or rollback

For review rejection, address the review notes, cut a new version, then submit the new candidate. For rollback after publication, release a new version pinned to the previous verified policy-engine artifact; never overwrite an immutable cut version.
