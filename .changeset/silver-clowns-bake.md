---
'@mastra/core': minor
---

Added auto-resume support for suspended workflows in dataset experiments. When a workflow suspends during an experiment run, the executor now automatically resumes it using resume data provided in the dataset item — either via top-level `resumeSteps` (keyed by step ID) or `resumeData` (flat, for single-step workflows). Storage-backed items can use `metadata.resumeSteps`/`metadata.resumeData`. If no resume data is available, the error message now includes guidance on how to provide it, and the suspend payload is returned as output for debugging. Multiple suspend/resume cycles are supported (capped at 10 to prevent infinite loops). ([#15382](https://github.com/mastra-ai/mastra/issues/15382))
