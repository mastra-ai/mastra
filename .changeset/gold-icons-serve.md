---
'mastracode': minor
---

Added storage backend configuration to `/settings` with PostgreSQL opt-in and remote LibSQL support.

**Selecting a backend**

Switch storage backends through the `/settings` command (Storage backend option) or by setting the `MASTRA_STORAGE_BACKEND` environment variable. LibSQL remains the default — no changes needed for existing setups. Both backends prompt for a connection URL interactively after selection.

**Remote LibSQL (Turso)**

Select LibSQL in `/settings` and enter a remote Turso URL (e.g. `libsql://your-db.turso.io`). Leave empty to keep the default local file database. Can also be set via environment variable:

```sh
export MASTRA_DB_URL="libsql://your-db.turso.io"
export MASTRA_DB_AUTH_TOKEN="your-token"
```

**PostgreSQL configuration**

Select PostgreSQL in `/settings` and enter a connection string, or configure via environment variables:

```sh
export MASTRA_STORAGE_BACKEND=pg
export MASTRA_PG_CONNECTION_STRING="postgresql://user:pass@localhost:5432/db"
```

If the PostgreSQL connection fails on startup, mastracode falls back to the local LibSQL database and shows a warning so you can fix the connection via `/settings`.

Optional PostgreSQL settings include `schemaName`, `disableInit`, and `skipDefaultIndexes`.
