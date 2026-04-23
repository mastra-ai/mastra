---
'mastra': patch
---

Fixed browser tool calls not rendering in Studio chat UI. Browser tools (`browser_*` and `stagehand_*`) were filtered from the chat, making it look like the agent was looping or idle. They now render inline alongside other tool calls.
