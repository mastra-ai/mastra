---
'@mastra/server': patch
---

Fixed memory status incorrectly reporting memory as enabled for agents without memory configured. The /api/memory/status endpoint now returns false for a resolved agent that has no memory, even when the Mastra instance has storage configured. Previously, Studio would render memory UI for such agents.
