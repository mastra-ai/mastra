---
'@mastra/server': patch
---

Hide the built-in Agent Builder agent (`builder-agent`) and stored agents marked `visibility: 'private'` from the `GET /agents` list response. Private stored agents remain visible to their owner (matching `authorId`). This prevents the Agent Builder picker from offering private agents and the builder agent itself as selectable tools.

Per-agent endpoints (`GET /agents/:id`, execute, etc.) are unchanged — the Agent Builder UI still loads the `builder-agent` directly by id; only list-based discovery (used by the tools/agents picker) is affected. Stored records carrying the canonical `builder-agent` id are also filtered out of the list response.
