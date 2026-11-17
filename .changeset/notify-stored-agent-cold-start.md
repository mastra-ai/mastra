---
'@mastra/core': patch
---

Notification delivery now resolves stored agents through the configured Mastra Editor. On a cold start a stored agent is not yet on the Mastra instance registry, so the dispatcher and the `get_notifications` tool failed with "Agent with id … not found" even though the agent existed. Both now fall back to the editor, and a lookup that fails for a reason which proves nothing about the agent — a storage or hydration error — leaves the notification pending instead of spending one of its delivery attempts (#30686).
