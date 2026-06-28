---
'mastracode': minor
---

Made the MastraCode web server a multi-org cloud service. The tenant boundary is now the WorkOS organization, with each user inside an org isolated from the others.

**Org-owned GitHub projects**

The GitHub App installation and each connected repository now belong to the organization, not an individual. Every user inside the org gets their own isolated sandbox, worktrees, branches, and pull requests against the org's repo. The same repository can be connected independently by different orgs, and they never see each other's projects, sandboxes, or state. Users without a WorkOS organization (personal accounts) can't connect GitHub projects but still get isolated agent state.

**Per-(org,user) agent-state isolation**

Agent state (threads, messages, memory, and recall vectors) is now isolated by the `(organization, user)` pair instead of by user alone. Two users in the same org are isolated from each other, and the same user across two orgs is isolated as well. The per-tenant database location is derived server-side from a hash of `(orgId, userId)`.

**Multi-replica deployment hardening**

- Per-(project,user) git write operations are serialized across replicas using Postgres advisory locks (`MASTRACODE_DISTRIBUTED_LOCK`, on by default; requires `APP_DATABASE_URL`). Set it to `0` for single-process local dev.
- GitHub OAuth/install state signing now requires a replica-stable secret in multi-replica setups. Set `GITHUB_APP_WEBHOOK_SECRET` (or `WORKOS_COOKIE_PASSWORD`); otherwise startup fails loudly because per-replica random secrets break callbacks.
- In-memory tenant stacks are now evicted by idle timeout and an LRU cap (`MASTRACODE_TENANT_IDLE_MINUTES`, `MASTRACODE_TENANT_MAX_APPS`) so memory stays bounded as a team grows.
- Set `MASTRACODE_REQUIRE_REMOTE_TENANT_DB=1` to fail/warn at startup when no remote tenant DB template is configured, since local-file tenant DBs don't persist or share across replicas.
- A per-replica live-sandbox cap (`MASTRACODE_MAX_SANDBOXES`) prevents one replica from exhausting the sandbox provider's quota, plus a per-user `DELETE /api/web/github/projects/:id/sandbox` route to tear down a user's own sandbox.

```bash
# Multi-replica hosted deployment
export GITHUB_APP_WEBHOOK_SECRET=...                     # replica-stable state signing
export MASTRACODE_DISTRIBUTED_LOCK=1                     # cross-replica git write locks
export MASTRACODE_REQUIRE_REMOTE_TENANT_DB=1            # require shared remote tenant DBs
export MASTRACODE_TENANT_DB_URL_TEMPLATE=libsql://{id}-org.turso.io
export MASTRACODE_TENANT_IDLE_MINUTES=30                 # evict idle tenant stacks
export MASTRACODE_TENANT_MAX_APPS=100                    # cap cached tenant stacks
export MASTRACODE_MAX_SANDBOXES=50                       # per-replica sandbox cap
```

Still deferred: collaboration within a project (multiple users sharing one worktree/sandbox/branch), org admin/roles and membership management, and project deletion at the org level.
