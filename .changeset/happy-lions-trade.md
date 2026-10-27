---
'@mastra/core': patch
---

Fixed structured output results and validation errors arriving after the finish event, so idle-thread subscribers receive them before the run ends. Runs that finish with an error no longer publish a final structured result or fallback value.
