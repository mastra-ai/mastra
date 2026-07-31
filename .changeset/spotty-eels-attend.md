---
'@internal/core': patch
'@mastra/core': patch
---

RequestContext values now keep their nested structure in observability traces. Objects and arrays stored in a RequestContext are handed to the trace serializer to walk and bound, instead of being collapsed to `[object]`, while the framework auth token stays redacted. To promote specific nested values to span metadata, use `requestContextKeys`.
