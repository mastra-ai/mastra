---
'@mastra/pg': patch
---

Fixed `PostgresStore` and `PgVector` rejecting schema names that are only valid when quoted, such as `my-tenant`. Any schema name up to 63 bytes is now accepted, as long as it has no quotes, backslashes, `$`, or control characters. Index and constraint names built from the schema use a sanitized prefix (`my-tenant` becomes `my_tenant_...`), so existing schemas keep their current index and constraint names.
