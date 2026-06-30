---
'mastracode': minor
---

Auto-provision a per-tenant Turso database in deployed MastraCode Web environments.

Previously, hosting per-`(org, user)` agent state on Turso required each tenant's database to already exist at the URL produced by `MASTRACODE_TENANT_DB_URL_TEMPLATE`. There was no way to create those databases on demand, so the only zero-setup option was server-local libSQL files — which are ephemeral and not shared across replicas.

Setting `MASTRACODE_TURSO_PLATFORM_TOKEN` and `MASTRACODE_TURSO_ORG` now enables a third tenant-storage mode: the first time a tenant is seen, its own Turso database is created via the Turso Platform API (idempotent — an "already exists" race recovers the hostname via `databases.get`), a scoped auth token is minted, and the stable database-name/hostname mapping is persisted in the app Postgres (`tenant_databases` table, requires `APP_DATABASE_URL`). All replicas converge on the same database and cold starts never re-create it. Only the durable mapping is stored; the auth token is minted fresh per resolution, so no long-lived credential is persisted.

Resolution priority is: explicit `MASTRACODE_TENANT_DB_URL_TEMPLATE` → Turso auto-provisioning → local libSQL files. Turso provisioning also satisfies `MASTRACODE_REQUIRE_REMOTE_TENANT_DB=1`. The `@tursodatabase/api` client is loaded dynamically, so deployments that don't use Turso never pull it in at runtime.

```bash
MASTRACODE_TURSO_PLATFORM_TOKEN=...    # Turso Platform API token
MASTRACODE_TURSO_ORG=my-org            # org that owns provisioned databases
MASTRACODE_TURSO_GROUP=default         # optional group (default "default")
APP_DATABASE_URL=postgres://...        # required for the mapping table
```
