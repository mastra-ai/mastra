# Provider-neutral staging

The default is a local Studio with a file database and temporary local credentials. Hosted mode runs the same Mastra HTTP API from its built bundle, using an external LibSQL service and OAuth 2 token introspection. Use your hosting platform's process manager, inbound HTTPS termination and secret injection.

## Supported topology

Run workers and the seed administrator on one host with the same persistent POSIX volume mounted at the same absolute path. Point them at the same LibSQL database and use the same writer lock file, dataset and identity configuration. The reference uses two worker processes over TCP. SQLite's OS lock serializes seed, publication and first draft-thread ownership. Closing a process releases the lock. Keep the lock file in place during restarts. Under contention, publication suspends for an explicit retry and draft binding denies the request so the client can retry.

This topology relies on SQLite filesystem locks. Verify your volume's SQLite locking semantics and use a single shared lock file for each database. Multiple hosts, serverless instances and independent container volumes require a distributed coordination mechanism. LibSQL holds Knowledge, Memory and workflow checkpoints for all workers.

## Configuration

Inject these values in the seed administrator and every worker.

```sh
SUPPORT_MODE=hosted
SUPPORT_DATABASE_URL=libsql://your-database.example
SUPPORT_DATABASE_AUTH_TOKEN=replace-with-database-service-token
SUPPORT_WRITER_LOCK_FILE=/srv/support-shared/support.writer.sqlite
```

The database URL must use `https:` or `libsql:` with no embedded credentials, query or fragment. `http:` is accepted only on `localhost`, `127.0.0.1` or `[::1]` for a local TCP reference server. The database token is mandatory even for that reference. Supply a real token for any service requiring authentication. Hosted mode never substitutes `.local/support.db`.

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

The installed Mastra build produces this entry point. Build once and deploy the same bundle and dependencies to each worker. The runtime needs the shared writable volume and outbound access to LibSQL, the identity service and the model. `npm run dev` launches local Studio. An authenticated `GET /api/knowledge` checks API access without making a model call. Forward both `/api` traffic and `POST /support/confirmations` through your proxy. The [Studio walkthrough](studio-walkthrough.md) describes support and review operations.

## Backup and restore

Use your LibSQL service's supported consistent snapshot/backup and restore procedure. Include all native tables: Knowledge, Memory and workflow snapshots must move together. Do not copy only the Knowledge tables. Stop ingress, drain requests and stop every worker and seed process before taking a cold backup or restoring. Hold the shared writer lock during any administrative database mutation, and do not delete or replace an active lock file. The lock sidecar itself contains no application records and is not the data backup.

For the single-host `sqld` reference, stop `sqld` after all clients stop and copy its complete data directory to private backup storage. Restore that complete directory with `sqld` stopped, preserve permissions, then restart it at the configured URL. Start one worker first and confirm scoped Knowledge, a saved conversation and a review checkpoint. Then start the remaining workers and reopen ingress. Keep the shared lock path stable. Obtain fresh OAuth tokens after restore. Maintain database access tokens, OAuth configuration and dataset versions separately in your configuration and secret store.

A restored checkpoint may precede a publication that an external client already observed. Existing publication markers reconcile exact replayed effects present in the restored snapshot. Set backup retention according to your acceptable recovery point. The reference check uses a stopped `sqld` directory copy and restore. Follow your provider's disaster recovery procedure for a managed database.

## Run the reference check

Build the bundle with `npx mastra build`. With `sqld` and `openssl` on your PATH, run `node tests/hosted/verify.mjs` to exercise two loopback workers and a disposable TCP database. The check creates its own HTTPS identity service and scripted model, verifies isolation and approval across restart, then restores the database into a fresh process. Set `SQLD_BIN` or `OPENSSL_BIN` if those executables are outside your PATH.
