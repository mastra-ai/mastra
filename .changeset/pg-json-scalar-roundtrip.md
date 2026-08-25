---
'@mastra/pg': patch
---

Fix `PgFactoryStorage` reads of `json` columns holding a JSON value that isn't an object.

node-pg parses JSONB through its own type parsers, so the value reaching row deserialization is already a JS value. Deserialization parsed it a second time when it was a string, which threw and failed the whole read. Objects and arrays came back as JS objects and never hit that branch, so the defect stayed hidden until a caller stored a string.

This surfaced through Factory credential encryption, which stores secrets as an opaque envelope string: saving or reading any credential on Postgres threw `Unexpected token ... is not valid JSON`, affecting model provider credentials, integrations, and custom providers. libsql was unaffected, since it stores `json` columns as text where parsing on read is correct.
