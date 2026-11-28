---
'@mastra/client-js': minor
---

Add `client.getFactoryWeb()` for the routes a Factory session reads outside Factory's own prefix: model config, provider credentials, voice and the session workspace. Hosts serve them under their own `webBasePath` (default `/web`). Request bodies that are a `Blob` are now sent as-is instead of JSON-encoded.
