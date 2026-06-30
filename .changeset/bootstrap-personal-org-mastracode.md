---
'mastracode': patch
---

Bootstrap a personal WorkOS organization for users who have none, so personal accounts can connect GitHub projects without hand-creating an org in the WorkOS dashboard.

Previously a signed-in user with no WorkOS organization hit a dead end (`{"error":"organization_required"}`) on the GitHub connect flow, because org-scoped features require an `organizationId` that personal accounts don't carry. On first authenticated use the web server now creates a personal organization for that user and adds them as a member, so their session resolves a real `organizationId` (via the WorkOS single-membership fallback) on subsequent requests, and the current request sees it immediately.

The bootstrap is idempotent (keyed on the user's WorkOS id, so retries/races don't create duplicate orgs) and best-effort: any WorkOS error is logged and swallowed, leaving the user in their existing no-org state rather than failing the request. It runs automatically whenever WorkOS auth is enabled. The WorkOS API key must be allowed to create organizations and memberships.

Multi-org creation, member invites, and org switching remain deferred — this change only guarantees every user always has at least one (personal) org.
