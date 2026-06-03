---
'@mastra/server': patch
---

Fixed memory status endpoint returning true for agents without memory configured, which caused Studio to render memory UI (thread sidebar, memory tab) when it shouldn't
