---
'@mastra/server': patch
---

Fixed dataset item endpoints to return HTTP 400 when payloads contain circular values, silently lossy JSON values (nested `undefined`, functions, symbols, bigints, and non-finite numbers), or non-plain objects (`Date`, `Map`, `Set`, class instances, and custom `toJSON()` objects) that cannot be serialized faithfully. Also fixed the add/update dataset item endpoints to persist the caller-provided `requestContext` entries instead of the live server request context instance, which contained internal server state and could fail storage serialization.
