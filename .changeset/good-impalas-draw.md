---
'@mastra/core': patch
---

Fixed provider-executed tool spans appearing outside the model step in traces. `PROVIDER_TOOL_CALL` spans now nest under the model step that delivered the tool result — matching how regular tool calls are traced — with their start time backdated to the tool call, so tools like OpenAI-hosted web search show up in the right place in the timeline. Tool input is now also captured whenever the provider supplies arguments. Calls whose result never arrives stay anchored to the agent run span. Fixes #20335.
