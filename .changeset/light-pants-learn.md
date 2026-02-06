---
'@mastra/ai-sdk': patch
---

Fixed AI SDK transformer fallback emitting routing agent's internal selection reasoning as visible text when the routing agent handles a request directly. The text fallback is now skipped for direct-handling (none/none) routing to avoid leaking internal reasoning. Fixes #12545.
