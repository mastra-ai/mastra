---
'@mastra/core': patch
---

Fixed `Agent.resumeGenerate()` and `Agent.resumeStream()` dropping `returnScorerData` on a plain Agent. A run started with `returnScorerData: true` now returns scoring data after a tool-approval or suspend resume, including when the resume happens in a different process or `defaultOptions` disable it. Passing `returnScorerData` to the resume call still overrides the run's value.
