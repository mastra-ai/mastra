---
"@mastra/core": patch
---

Background-dispatched sub-agent delegations no longer send null tool-message content

When a sub-agent invocation (an `agent-<name>` tool) is dispatched as a background task, the agentic loop returns a placeholder result of the shape `{ result: string }` (see `tool-call-step.ts`) instead of the sub-agent's `agentOutputSchema` shape. The sub-agent tool's `toModelOutput` read `output.text`, which is `undefined` for that placeholder, so the supervisor's next request carried a `role: "tool"` message with `null` content. Providers that validate tool content (e.g. Anthropic) reject that with a 500, breaking the supervisor turn whenever it backgrounds a sub-agent (`backgroundTasks.tools: { someSubAgent: { enabled: true } }`).

`toModelOutput` now falls back to the placeholder's `result` (and then to an empty string) so the tool message always carries non-empty content, letting the supervisor acknowledge the dispatch and continue while the sub-agent runs in the background.
