# Shared review service

Shared review is an optional separation-of-duties mode. The default remains the existing single-user Anna workflow. When enabled, REVIEW receipts are submitted to an authenticated Vercel Functions API; the static Anna bundle never receives database or Clerk secret keys.

## Architecture

- Clerk verifies requester and reviewer bearer tokens at the Function boundary.
- Neon Postgres stores teams, membership, requests, assignments, comments, immutable events, and requester notifications.
- Team membership is checked inside every data query. Requesters see their own items; reviewers and admins can see their team's queue.
- Resolution is a single conditional SQL transition from `pending` to `resolved`. A competing decision cannot overwrite the winner and creates a `resolution.conflict` audit event.
- `prohibit_self_approval` defaults to true. Assignment also prevents an unassigned reviewer from resolving another reviewer's item unless that user is an admin.

## Provision and deploy

1. Link a dedicated Vercel project for this repository.
2. Provision Neon and Clerk through the Vercel Marketplace so `DATABASE_URL` and `CLERK_SECRET_KEY` are injected server-side.
3. Pull the development environment with `vercel env pull .env.local`, then apply [`review-service/schema.sql`](../review-service/schema.sql) with `pnpm db:review:migrate` (or use the Neon SQL console).
4. Set `REVIEW_ALLOWED_ORIGINS` to the exact released Anna App origin and `REVIEW_AUTHORIZED_PARTIES` to the exact Clerk frontend/portal origins.
5. Seed the first `review_teams` row and one Clerk user as an `admin` in `review_members`; all later membership changes go through the admin-only endpoint.
6. Deploy the Vercel project, then add its HTTPS origin to `manifest.ui.bundle.external_origins` before cutting the Anna release.
7. Supply `window.__ANNA_SHARED_REVIEW__ = { baseUrl, teamId, getToken }` from the authenticated integration layer. No service credential belongs in this object.

## Reviewer portal

The deployed service includes a same-origin portal at `/review`. The Clerk publishable key is delivered by `/api/config`; secret keys remain server-only. The first authenticated user can initialize the single default team and becomes its admin. Additional users sign in once, copy the displayed Clerk user ID, and have the admin add that ID as a requester, reviewer, or admin.

Requesters can export a `REVIEW` Decision Receipt from the Anna app and upload that JSON in the portal. Reviewers then see the shared queue and can record an `ALLOW` or `BLOCK` decision with a required rationale. Self-approval remains prohibited by default. This upload path is the deployment-independent fallback; an authenticated Anna integration may instead use `bundle/shared-review.js` to submit the same receipt directly.

The account-bound provisioning steps must be completed before shared mode is enabled. Without that runtime configuration, `bundle/shared-review.js` is disabled and all current single-user behavior remains available.

## Retention, privacy, and deletion

Receipts may contain operational metadata, evidence labels, and reviewer comments. Do not put credentials, raw secrets, or unnecessary personal data in a proposal. Each team configures `retention_days` (30–2,555 days; default 365). A scheduled retention job should delete expired requests, whose comments, events, and notifications cascade. Team deletion cascades the entire team queue. Clerk account deletion must also remove that user's membership and either pseudonymize or delete actor identifiers according to the team's legal requirements.

Access and conflict events are audit records. Export them before a requested deletion when retention law or an incident hold requires preservation. Notification rows are marked read when delivered; they are not a durable substitute for the receipt history.
