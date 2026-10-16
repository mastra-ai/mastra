---
'@mastra/playground-ui': patch
'@mastra/react': patch
---

Improved how Studio shows traces that started outside Mastra, such as one HTTP request that calls several agents.

- The top-level runs of such a trace now sit under one "Started outside Mastra" group in the trace view.
- Run durations no longer stretch to the end of the whole trace. Each run ends where its own work ends.
- The trace list shows such a trace once, under its earliest run.
