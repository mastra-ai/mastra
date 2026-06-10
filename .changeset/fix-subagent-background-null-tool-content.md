---
"@mastra/core": patch
---

Background-dispatched sub-agent delegations no longer send null tool-message content

When a sub-agent invocation (an `agent-<name>` tool) is dispatched as a background task, the agentic loop hands the sub-agent tool's `toModelOutput` the placeholder string from `tool-call-step.ts` ("Background task started...") instead of the `agentOutputSchema` object. `toModelOutput` read `output.text`, which is undefined for that string, so the supervisor's next request carried a `role: "tool"` message with null content. Providers that validate tool content (e.g. Anthropic) reject that with a 500, breaking the supervisor turn whenever it backgrounds a sub-agent (`backgroundTasks.tools: { someSubAgent: { enabled: true } }`).

`toModelOutput` now uses the placeholder string directly when the output is a string, so the tool message always carries non-empty content and the supervisor can acknowledge the dispatch and continue while the sub-agent runs in the background.
