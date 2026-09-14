---
'@mastra/server': patch
---

Fixed parsing of request bodies supplied as `undefined` to preserve whole-schema defaults and optional values while supporting defaults for bodyless object fields. The empty-object fallback is limited to object schemas, so omitted required record bodies remain invalid. When no fallback succeeds, validation retains the original missing-input error. Explicit null and other falsy JSON values are validated without being replaced.
