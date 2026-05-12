---
'@internal/playground': patch
---

**Studio — workflow agent transcripts**

- Workflow runs list embedded-agent conversations from memory; ordering uses each step’s `startedAt` when the active run includes step timings (with timestamp fallbacks). Long titles truncate with an ellipsis.
- Workflow graph nodes for embedded agent steps include **Open chat** and **Preview**, reusing the same agent chat UI as the full agent page.
- Kitchen-sink adds `workflow-agent-demo` (foreach + branch) for transcript coverage; optional live OpenAI defaults to **gpt-5-nano**; `KITCHEN_SINK_TRACE=1` enables verbose Mastra logs without bundling `@mastra/observability`.
