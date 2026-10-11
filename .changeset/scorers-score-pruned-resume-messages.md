---
'@mastra/core': patch
'@mastra/memory': patch
'@mastra/inngest': patch
---

Fixed live scorers missing tool calls when observational memory is enabled. Observational memory removes messages from the agent's context once it has observed them, and live scorers only saw the messages that were left. On runs that suspend and resume, scorer `output` could miss every tool call made before `suspend()`, or end up empty. Scorers now receive every response message the run produced, across all suspend/resume segments, under the original `runId`. The prompt sent to the model is unchanged.
