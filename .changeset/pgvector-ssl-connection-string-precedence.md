---
'@mastra/pg': patch
---

Fixed `PgVector` ignoring an explicit `ssl` option when the connection string also contained an `sslmode=` (or `ssl=`) query parameter. `node-postgres` re-parses the connection string and overwrote the explicit `ssl` object, causing `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` / "self-signed certificate" errors against self-signed or internal CAs even when verification was meant to be skipped.

`PgVector` now honors an explicit `ssl` option over the connection string, matching the existing `PostgresStore` behavior. Connection-string-only SSL (`?sslmode=require` with no explicit `ssl`) keeps working as before.

```ts
import { PgVector } from '@mastra/pg';

// This now connects instead of throwing UNABLE_TO_GET_ISSUER_CERT_LOCALLY
const vector = new PgVector({
  id: 'my-vector',
  connectionString: 'postgresql://user:pass@host:5432/db?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
```
