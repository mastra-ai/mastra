---
'@mastra/core': patch
---

Fixed a leak where dataset/experiment score persistence wrote the live `RequestContext` to score rows via `entries()`. The framework-managed auth token (`mastra__authToken`) and other serializable secrets were stored in cleartext, and non-serializable values (functions, RPC proxies, cycles) could break storage.

Score persistence now writes a JSON-safe snapshot through `RequestContext.toJSON()` and omits the auth token, matching the live scorer-hook path. This completes the persistence-boundary coverage started when token persistence was removed from the workflow-snapshot, live-hook, and durable-agent paths.
