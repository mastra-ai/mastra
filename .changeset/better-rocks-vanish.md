---
'@mastra/playground-ui': patch
---

Improved the span details panel in Studio traces. Each span now opens with a one-sentence summary of what it did, naming the agent, model, tool or processor involved, for example "gpt-5-mini called weatherInfo, then wrote the answer", "Loaded 2 earlier messages from memory into the conversation" or "moderation ran and left the messages unchanged", in a color that matches the result. The sections below are ordered by relevance: the output comes first for tool, model and agent spans, the message changes for memory, workspace, skill and processor spans, and the error for failed spans.
