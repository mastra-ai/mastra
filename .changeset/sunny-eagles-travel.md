---
'@mastra/playground-ui': patch
---

Improved the connect card that `request_connection` renders in chat:

- **Continues the agent turn:** once the user finishes connecting, the card sends a short follow-up message so the agent carries on with the task instead of waiting to be prompted again.
- **Shows the new tools right away:** the agent and tool lists refresh as soon as a connection activates or is disconnected.
