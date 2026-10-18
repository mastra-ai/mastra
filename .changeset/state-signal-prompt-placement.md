---
'@mastra/core': patch
---

Fixed empty model replies when an agent's state (for example a browser or task list) was recorded earlier in the run and only tool calls followed. The model prompt now places the newest state last, so it no longer ends on a tool result. Some models, such as Gemini 3 Flash, returned an empty reply to the old prompt shape. Stored messages and recall keep their original order.
