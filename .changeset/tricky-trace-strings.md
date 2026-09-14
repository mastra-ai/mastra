---
'@mastra/pg': patch
---

Fix PostgresStoreVNext observability trace reader dropping scalar-string span inputs and outputs. The pg driver already decodes JSONB columns into native JS values, but the reader re-parsed decoded strings, so a stored string like `hello` threw during `JSON.parse` and was returned as `undefined`, while JSON-looking strings such as `123` or `true` were coerced to a number or boolean. Decoded JSONB values are now returned unchanged, preserving both value and type. Fixes #23575.
