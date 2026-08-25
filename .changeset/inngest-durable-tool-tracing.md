---
'@mastra/inngest': patch
---

Fix durable tool execution on the Inngest engine running with no tracing context. The `extract-tool-calls` step now forwards the LLM step's exported `model_step` span onto every tool-call input (matching @mastra/core's durable workflow), so each tool call creates a live `tool_call` span with execution-time children (e.g. `workspace_action` and client-tool spans) nested under the LLM call. The retroactive `tool_call` span creation in the collect step was removed — it produced childless duplicate spans and redundant step-span end/tool-result chunk events already handled by the shared LLM mapping step. Fixes #19842.
