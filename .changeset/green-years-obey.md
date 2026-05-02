---
'@mastra/ai-sdk': minor
---

Added a Harness display-state adapter for AI SDK UI.

Use harnessToUIMessageStream from @mastra/ai-sdk/harness to stream Harness snapshots, assistant text, reasoning, and native AI SDK tool lifecycle chunks into AI SDK UI routes. The adapter emits a stable data-mastra-harness-snapshot baseline for tools, human-in-the-loop state, tasks, observational memory progress, modified files, usage, and subagents.

It also supports delta mode, which starts with a full snapshot and then emits append-only data-mastra-harness-delta parts for changed fields and domains. This gives apps one supported bridge from Harness display state to AI SDK UI instead of rebuilding the mapping in each route.

Closes https://github.com/mastra-ai/mastra/issues/15975
