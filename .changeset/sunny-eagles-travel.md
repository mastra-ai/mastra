---
'@mastra/playground-ui': patch
---

Improved the connect card that `request_connection` renders in chat:

- **Resumes the agent:** the card now appears while the run is paused on `request_connection`. Once the user's connection activates, the card resumes the paused tool, so the agent continues from the tool result. No message is added to the chat.
- **Shows the new tools right away:** agent and tool lists refresh as soon as a connection activates or is disconnected.
- **Loading state on the Connections page:** the connections table shows skeleton rows while it loads, instead of a bare spinner.
