---
'@mastra/ai-sdk': minor
---

Added a Harness display-state adapter for the AI SDK UI.

Use `harnessToUIMessageStream` from `@mastra/ai-sdk/harness` to stream Harness display state into AI SDK UI output, including assistant text, reasoning, tool updates, human-in-the-loop state, tasks, files, usage, and subagent progress.

It sends a full initial snapshot and can switch to delta mode for incremental updates, so apps can reuse one supported mapping instead of rebuilding it in every route.
