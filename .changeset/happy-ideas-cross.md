---
'mastra': patch
---

MCP Apps in Studio chat can now hand context to the agent. Studio keeps the latest context from each app and adds it to your next message only, as a clearly marked block of untrusted app data. The context never reaches the agent's instructions, so an app cannot give the model orders with system-level authority, and you can see what the app shared in the chat. For example, a dashboard drilldown passes the exact filters you clicked and posts a short message. If the message fails to send, the context is kept for the retry.
