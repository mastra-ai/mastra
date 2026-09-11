---
'@mastra/mcp': patch
---

Carry `resources.subscribe`/`resources.unsubscribe` and list-changed handlers on one managed `subscriptions/listen` stream per server. The stream is replaced when the interest set changes, serialized under concurrent mutations, restored after a reconnect, and closed on disconnect; a subscription the server declines rejects. The raw `subscriptions.listen` accessor is removed in favor of this managed stream, and `pnpm test:conformance` runs the official 2026-07-28 HTTP conformance scenario against `MCPServer`.
