---
'@mastra/server': minor
'@mastra/editor': patch
'@mastra/core': patch
---

Added version query parameters to GET /api/agents/:agentId endpoint. Code-defined agents can now be resolved with specific stored config versions using ?status=draft (latest, default), ?status=published (active version), or ?versionId=<id> (specific version).
