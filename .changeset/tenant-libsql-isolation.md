---
'mastracode': minor
---

Isolated per-user agent-state storage for the MastraCode web server. When WorkOS web auth is enabled, every authenticated user now operates against their own dedicated libSQL database for all agent state (threads, messages, memory, working/observational memory, and recall vectors) instead of a single shared store. The server dispatches each authenticated request to a per-user Mastra controller bound to that user's storage, so no tenant can read another tenant's conversations or memory at the storage layer — not just by `resourceId` convention.

The per-user database location is derived server-side from a hashed WorkOS user id (no client-supplied paths). By default each user gets local libSQL files (`storage.db` + `vectors.db`) under `MASTRACODE_TENANT_DB_ROOT` (default `~/.mastracode/web/tenants/<sha256(id)>/`). For hosted deployments, set `MASTRACODE_TENANT_DB_URL_TEMPLATE` (optionally with `MASTRACODE_TENANT_VECTOR_URL_TEMPLATE` and auth tokens) to point each tenant at a remote libSQL/Turso database via a `{id}` template.

When web auth is disabled the server keeps using the single shared store exactly as before, and the local/TUI path is untouched.

Optional hosted-deployment configuration:

```bash
# Local files (default): one isolated DB dir per user
MASTRACODE_TENANT_DB_ROOT=/data/mastracode/tenants

# Or remote libSQL/Turso per tenant ({id} = hashed WorkOS user id)
MASTRACODE_TENANT_DB_URL_TEMPLATE=libsql://{id}-org.turso.io
MASTRACODE_TENANT_VECTOR_URL_TEMPLATE=libsql://{id}-vec-org.turso.io
MASTRACODE_TENANT_DB_AUTH_TOKEN=xxxxxxxx
MASTRACODE_TENANT_VECTOR_AUTH_TOKEN=xxxxxxxx
```
