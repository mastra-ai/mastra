---
'@mastra/connect': minor
---

Added a Connect card for `request_connection` in Slack, Telegram and Teams threads. Before, a thread where the agent asked the user to connect an account stayed stuck, because nothing was posted for the paused call.

Now the thread shows a card with **Connect** and **Cancel**:

- **Connect** sends the provider's sign-in link only to the person who clicked: an ephemeral message in Slack, a DM elsewhere. Only the person the conversation belongs to can start a sign-in. The link never appears in the shared thread.
- The card then offers **I've connected**, which checks the connection and lets the agent continue, or keeps waiting if it isn't done yet.
- **Cancel** ends the call with "The user cancelled connecting.", as Studio's card does.
- If the link can't be sent privately, the card asks the user to connect from the app.

Requires the `@mastra/core` release that adds paused-tool cards to channels.
