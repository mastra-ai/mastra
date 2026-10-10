---
'@mastra/playground-ui': minor
---

Added `ConnectionRequestCard`, a chat card that asks the user to connect an integration. Studio chat now renders `data-mastra-connect-request` parts as this card and follows the request to connected, couldn’t connect, not now, or link expired from the thread's signals. Wrap chat in `ConnectRequestActionsContext` with `onConnect` and `onDecline` to show the Connect and Not now buttons.
