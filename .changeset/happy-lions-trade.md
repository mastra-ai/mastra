---
'@mastra/server-adapters-test-suite': patch
'@mastra/core': patch
---

Fixed structured output results and validation errors arriving after the finish event, so idle-thread subscribers receive them before the run ends.
