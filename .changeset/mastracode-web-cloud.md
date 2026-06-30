---
'mastracode': minor
---

Turned MastraCode Web into a multi-org cloud coding service. When WorkOS auth and a GitHub App are configured, a team can sign in, connect their repos, and run coding agents that branch, commit, push, and open pull requests — all from isolated cloud sandboxes. When the relevant environment variables are absent, the server and UI behave exactly as before (local-path projects, single shared store, no auth UI), so this is fully opt-in.

**Authentication (WorkOS AuthKit).** Setting `WORKOS_API_KEY` and `WORKOS_CLIENT_ID` protects every route: unauthenticated visitors are redirected to the WorkOS hosted login, signed-in users get an encrypted session, expired sessions bounce back to login, and the sidebar shows the signed-in email with a Sign out button. Users with no WorkOS organization get a personal org bootstrapped on first authenticated use (idempotent, with recovery from partial creations), so personal accounts can use org-scoped features without hand-creating an org.

**Org-owned GitHub projects.** With the GitHub App env vars set (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_SLUG`, `APP_DATABASE_URL`), users install/connect the app, pick repos they can access, and turn each into a project. The installation and connected repos belong to the WorkOS organization; the same repo can be connected independently by different orgs with no cross-visibility. Each repo is materialized into an isolated cloud sandbox on open — cloned (or pulled) inside the sandbox with a short-lived installation token that never reaches the browser and is scrubbed from the remote afterward.

**Cloud coding-agent write-back.** From a connected repo, each user gets their own sandbox, git worktrees, and feature branches. The agent runs against the selected worktree (file edits and commands bind to its path) and can commit, push, and open pull requests via the in-sandbox `gh` CLI, authenticated with short-lived per-operation installation tokens. The sidebar shows a nested project → worktree → conversations tree with a "+ New worktree" affordance; conversations scope per worktree.

**Sandbox providers.** A provider is selected automatically: Railway when `RAILWAY_API_TOKEN` is set, otherwise a local provider that runs git directly on the host (single-user local dev only — no tenant isolation). `MASTRACODE_SANDBOX_PROVIDER` overrides explicitly. Idle sandboxes are torn down and re-provisioned on the next open; a per-replica live-sandbox cap (`MASTRACODE_MAX_SANDBOXES`) and a per-user teardown route bound resource use.

**Per-(org,user) state isolation.** Agent state (threads, messages, memory, recall vectors) is isolated by the `(organization, user)` pair, each backed by a dedicated libSQL database whose location is derived server-side from a hash of `(orgId, userId)` — never a client-supplied path. By default each tenant gets local libSQL files under `MASTRACODE_TENANT_DB_ROOT`; for hosted deployments, point each tenant at a remote libSQL/Turso database via `MASTRACODE_TENANT_DB_URL_TEMPLATE` (plus optional vector template and auth tokens).

**Sandbox isolation hardening.** Commands run in the local sandbox receive only a sanitized allow-list of environment variables (PATH/HOME/locale/git config), so server secrets such as `GITHUB_APP_PRIVATE_KEY`, `WORKOS_API_KEY`, and `APP_DATABASE_URL` are never exposed to code running against an untrusted checkout. Sandbox filesystem write operations (write/append/copy/move/mkdir) now verify the destination's real path — including a symlinked parent directory — stays within the workspace root, preventing a malicious repo's symlink from redirecting writes outside the sandbox.

**Multi-replica deployment hardening.** Per-(project,user) git writes are serialized across replicas with Postgres advisory locks (`MASTRACODE_DISTRIBUTED_LOCK`, on by default; requires `APP_DATABASE_URL`). OAuth/install state signing requires a replica-stable secret in multi-replica setups, in-memory tenant stacks are evicted by idle timeout and an LRU cap (`MASTRACODE_TENANT_IDLE_MINUTES`, `MASTRACODE_TENANT_MAX_APPS`), and `MASTRACODE_REQUIRE_REMOTE_TENANT_DB=1` fails startup when no shared remote tenant DB is configured.

```bash
# Auth + GitHub App (opt-in)
WORKOS_API_KEY=sk_xxxxxxxx
WORKOS_CLIENT_ID=client_xxxxxxxx
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_APP_CLIENT_ID=Iv1.xxxxxxxx
GITHUB_APP_CLIENT_SECRET=xxxxxxxx
GITHUB_APP_SLUG=your-app-slug
APP_DATABASE_URL=postgres://user:pass@host:5432/mastracode_web

# Multi-replica hosted deployment
GITHUB_APP_WEBHOOK_SECRET=...                      # replica-stable state signing
MASTRACODE_DISTRIBUTED_LOCK=1                       # cross-replica git write locks
MASTRACODE_REQUIRE_REMOTE_TENANT_DB=1              # require shared remote tenant DBs
MASTRACODE_TENANT_DB_URL_TEMPLATE=libsql://{id}-org.turso.io
MASTRACODE_TENANT_IDLE_MINUTES=30
MASTRACODE_TENANT_MAX_APPS=100
MASTRACODE_MAX_SANDBOXES=50
```

Still deferred: collaboration within a project (multiple users sharing one worktree/sandbox/branch), org admin/roles and membership management, and org-level project deletion.
