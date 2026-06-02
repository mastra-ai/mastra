---
'@mastra/pg': patch
---

Fixed `PostgresStore` ignoring an explicit `ssl` option when the `connectionString` also carries an `sslmode=`/`ssl=` query param. node-postgres re-parses the connection string and `Object.assign`s the URL-derived `ssl` over the explicit one, so a config like `{ connectionString: '...?sslmode=require', ssl: { rejectUnauthorized: false } }` silently dropped `rejectUnauthorized: false` and failed with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` against self-signed CAs. The connection-string branch now parses the URL and applies the explicit `ssl` last, while still honoring URL-driven SSL when no `ssl` option is provided. Fixes #17307.
