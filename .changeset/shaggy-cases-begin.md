---
'@mastra/factory': patch
---

The web transcript now reads the agent controller's real event payloads. It was branching on an `om_activation.enabled` flag the controller never sends, and casting token usage and memory progress into hand-written shapes that no longer matched the stream. No visible change; the status line and memory rings behave as before.
