---
'@mastra/core': patch
---

Fixed observers of a plain `Agent` run (`agent.observe()`, reconnecting clients) receiving sub-agent progress chunks and the run's error chunks timed by when they were published instead of when they were produced, which could make thread history show an already stored part again.
