---
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
---

Added storage for item-level tool mocks. Dataset items persist their `toolMocks` and experiment results persist their `toolMockReport`, so mocks and run diagnostics survive across sessions.
