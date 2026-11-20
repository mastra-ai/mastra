# Provider-neutral staging

The default is a local Studio with a file database and temporary local credentials. Hosted mode runs the same Mastra HTTP API from its built bundle, using an external LibSQL or PostgreSQL service and OAuth 2 token introspection. Use your hosting platform's process manager, inbound HTTPS termination and secret injection.

## Supported topology

For LibSQL, run workers and the seed administrator on one host with the same persistent POSIX volume mounted at the same absolute path. Point them at the same LibSQL database and use the same writer lock file, dataset and identity configuration. The reference uses two worker processes over TCP. SQLite's OS lock serializes seed, publication and first draft-thread ownership. Closing a process releases the lock. Keep the lock file in place during restarts. Under contention, publication suspends for an explicit retry and draft binding denies the request so the client can retry.

The LibSQL topology relies on SQLite filesystem locks. Verify your volume's SQLite locking semantics and use a single shared lock file for each database. LibSQL workers on independent hosts or volumes need a different coordination mechanism.

For PostgreSQL, point every worker and seed administrator at the same explicit database on one writable PostgreSQL primary. The native `PostgresStore` holds Knowledge, Memory and workflow checkpoints in the default `public` schema. Seed, publication and first draft-thread ownership use a PostgreSQL session advisory lock in that database. Contention fails promptly so clients can retry. PostgreSQL releases the lock when its owning session ends. All workers and releases use the same lock key regardless of connection URL aliases.

Use direct connections or a session pooler that preserves one server session for the entire client connection. Transaction and statement pooling are unsupported because session advisory locks would not protect the operation. Each active lock uses an extra database connection in addition to the storage pool. Reserve sufficient database connections for all workers and administrative writers.

The PostgreSQL reference exercises two processes against one healthy PostgreSQL 16 primary over loopback TCP, including owner exit and restart. The lock and storage writes use separate connections. A lost lock session can leave a write in flight, and every writer must follow the same coordination protocol. Stop ingress and affected workers before recovering from a connection loss or primary failover. Validate your provider and pooler topology separately.

## Configuration

Inject the appropriate database configuration in the seed administrator and every worker. For LibSQL, use the following values.

```sh
SUPPORT_MODE=hosted
SUPPORT_DATABASE_URL=libsql://your-database.example
SUPPORT_DATABASE_AUTH_TOKEN=replace-with-database-service-token
SUPPORT_WRITER_LOCK_FILE=/srv/support-shared/support.writer.sqlite
```

The database URL must use `https:` or `libsql:` with no embedded credentials, query or fragment. `http:` is accepted only on `localhost`, `127.0.0.1` or `[::1]` for a local TCP reference server. The database token is mandatory even for that reference. Supply a real token for any service requiring authentication. Hosted mode never substitutes `.local/support.db`.

For PostgreSQL, set the hosted mode and database URL.

```sh
SUPPORT_MODE=hosted
SUPPORT_DATABASE_URL=postgresql://support:percent-encoded-password@your-database.example:5432/support?sslmode=verify-full
```

Both `postgres://` and `postgresql://` select PostgreSQL. Specify the database name explicitly for the seed and runtime. The URL accepts only the `sslmode` option. Non-loopback connections require `sslmode=verify-full`, which encrypts traffic and verifies the server certificate and hostname. For a private CA, configure `NODE_EXTRA_CA_CERTS` for every worker and seed process. Loopback connections may omit `sslmode` or use `sslmode=disable` for a disposable local test. Keep the connection string private. Include the database credentials in that string. PostgreSQL itself provides the writer lock. Provision the database before seeding and grant the role permission to create and use Mastra's native tables and indexes in `public`.

Set these variables for every worker.

```sh
SUPPORT_HOST=127.0.0.1
PORT=4111
SUPPORT_OAUTH_INTROSPECTION_URL=https://identity.example/oauth/introspect
SUPPORT_OAUTH_INTROSPECTION_TOKEN=replace-with-introspection-service-token
SUPPORT_OAUTH_ISSUER=https://identity.example
SUPPORT_OAUTH_AUDIENCE=knowledge-support
OPENAI_API_KEY=replace-with-model-key
```

Choose an explicit bind address appropriate to the host. For example, bind to loopback behind a local HTTPS proxy, or `0.0.0.0` inside a private container network with inbound TLS termination and network policy. Local mode always binds to `127.0.0.1`. Use different `PORT` values for workers on the same host. Forward `Authorization` intact through your proxy. Do not put end-user tokens in URLs. Keep database, introspection and model service credentials outside Git, logs and browser configuration.

## External identity contract

The application sends an RFC 7662 form POST containing `token` and `token_type_hint=access_token` to the configured HTTPS introspection endpoint. The request authenticates with the configured service bearer token. Redirects are rejected and the request times out after five seconds. Use an identity provider or identity gateway that supports this service authentication method. There is no local credential-file bypass in hosted mode.

A successful response has this shape.

```json
{
  "active": true,
  "exp": 2000000000,
  "iss": "https://identity.example",
  "aud": "knowledge-support",
  "sub": "technician-17",
  "tenant_id": "retailops",
  "customer_id": "store-42",
  "scope": "support:technician"
}
```

`exp` is an unexpired integer Unix timestamp. `iss` must exactly match the configured issuer. `aud` must match the configured audience or contain it in an array. A future `nbf`, if supplied, is denied. `sub`, `tenant_id` and `customer_id` must be nonempty strings issued by the identity service. `sub` supplies both the actor and profile ID. Request bodies and request context cannot override these claims. An unknown or inactive token, an unavailable identity service, malformed claims or a missing supported scope denies access.

Grant `support:technician` for support conversations and scoped Knowledge reads. Reserve `support:reviewer` for people permitted to review. That grant includes support reads and conversations. A reviewer can approve their own proposals for another technician's confirmation, including after restart. The server enforces tenant and customer scope and checks the current authenticated profile before publication. Every API request introspects its token and uses the resulting grant until it expires. Revoke tokens at the identity service. Access tokens never enter Memory, Knowledge or workflow checkpoints. Local mode reloads its credential file and checks reviewer revocation before writes.

## Seed and build

Install with `npm ci`, then run the seed from the template directory with the shared hosted database configuration.

```sh
npm run knowledge:seed -- --dry-run
npm run knowledge:seed
npm run knowledge:seed -- --dataset retail-pos-history
npx mastra build
```

Run the seed as a privileged administrator with the database service credential. It takes the same shared lock as publication. Run one administrator process at a time and keep the dataset source files available to that process. A busy seed exits with status 75. Retry after the active writer exits. Seed explicitly before starting a worker with a new database.

Start each worker from the template directory with the complete worker environment.

```sh
node .mastra/output/index.mjs
```

The installed Mastra build produces this entry point. Build once and deploy the same bundle and dependencies to each worker. The runtime needs outbound access to its configured database, the identity service and the model. LibSQL workers also need the shared writable coordination volume. `npm run dev` launches local Studio. An authenticated `GET /api/knowledge` checks API access without making a model call. Forward both `/api` traffic and `POST /support/confirmations` through your proxy. The [Studio walkthrough](studio-walkthrough.md) describes support and review operations.

## Backup and restore

Use your database service's supported consistent snapshot/backup and restore procedure. Include all native tables: Knowledge, Memory and workflow snapshots must move together. Do not copy only the Knowledge tables. Stop ingress, drain requests and stop every worker and seed process before taking a cold backup or restoring. Keep all writers stopped throughout administrative database mutations. With LibSQL, do not delete or replace an active lock file; its sidecar contains no application records and is not the data backup.

For the single-host `sqld` reference, stop `sqld` after all clients stop and copy its complete data directory to private backup storage. Restore that complete directory with `sqld` stopped, preserve permissions, then restart it at the configured URL. Start one worker first and confirm scoped Knowledge, a saved conversation and a review checkpoint. Then start the remaining workers and reopen ingress. Keep the shared lock path stable. Obtain fresh OAuth tokens after restore. Maintain database access tokens, OAuth configuration and dataset versions separately in your configuration and secret store.

For PostgreSQL, back up the complete application database with your provider’s consistent snapshot facility or `pg_dump --format=custom`. Restore into a provisioned empty database with `pg_restore --no-owner --exit-on-error` using a role with the required schema permissions. Update every seed and worker connection string to the restored database, retaining verified TLS outside loopback. The reference check uses `pg_dump` and `pg_restore` on a disposable PostgreSQL 16 cluster and verifies scoped Knowledge, saved Memory and the exact review audit after restore. It does not exercise managed failover or point-in-time recovery.

A restored checkpoint may precede a publication that an external client already observed. Existing publication markers reconcile exact replayed effects present in the restored snapshot. Set backup retention according to your acceptable recovery point. The reference check uses a stopped `sqld` directory copy and restore. Follow your provider's disaster recovery procedure for a managed database.

## Run the reference check

Build the bundle with `npx mastra build`. With `sqld` and `openssl` on your PATH, run `node tests/hosted/verify.mjs` to exercise two loopback workers and a disposable TCP database. The check creates its own HTTPS identity service and scripted model, verifies isolation and approval across restart, then restores the database into a fresh process. Set `SQLD_BIN` or `OPENSSL_BIN` if those executables are outside your PATH.

To run the same suite against PostgreSQL 16, use `SUPPORT_TEST_BACKEND=postgres node tests/hosted/verify.mjs`. It initializes a disposable trust-authenticated loopback cluster, starts two built workers without a shared lock file, and backs up/restores with `pg_dump`/`pg_restore`. PostgreSQL executables must be on your `PATH`, or set `POSTGRES_BIN` to their directory (for example, `/opt/homebrew/opt/postgresql@16/bin` on Homebrew). Never point this check at a production database.
