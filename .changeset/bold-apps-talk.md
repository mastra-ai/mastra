---
'@mastra/mcp-apps-components': minor
---

The trace viewer and trace explorer apps now work with the conversation in clients that support it:

- They tell the model what's on screen: the open trace and span, the explorer's tab and filters, or the open log.
- **Ask about this** buttons on a trace, span, or log send a message about it to the conversation.
- A **Fullscreen** button opens the app full screen.
- An **Open in Studio** button opens the same view in Studio, when the server sends Studio's URL.
