---
'@mastra/server': minor
'@mastra/client-js': minor
---

Added read-only Knowledge routes to the Mastra server (`GET /knowledge`, `/knowledge/:knowledgeKey/graph`, `/nodes/:nodeId`, `/search`, `/activity`), gated by a new `knowledge:read` permission, and matching `listKnowledge()` / `getKnowledge(key)` methods on the JS client. Each read takes the scope tags the viewer holds and returns only what those tags can see.
