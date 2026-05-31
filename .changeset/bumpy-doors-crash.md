---
'@mastra/core': patch
---

Fixed failed tool calls showing up as successful when a conversation is reloaded from history. Previously a tool that threw an error displayed correctly while the agent was running, but reappeared as a successful result once the conversation was loaded from memory. The error is now preserved and displayed on reload, matching what you see during the live run. Fixes #15569.
