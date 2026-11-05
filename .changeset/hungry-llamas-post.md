---
'@mastra/playground-ui': patch
---

Fixed chat messages showing raw MCP App context. When a user interacted with an MCP App (for example, drilling into a dashboard chart), the context the app sent to the model appeared in the user's message bubble, the conversation timeline, and copied text. It is now hidden from the UI and still sent to the model.
