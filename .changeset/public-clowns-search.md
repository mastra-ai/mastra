---
'@mastra/playground-ui': patch
---

Fixed the chat's connect-account card leaving the agent stuck when the user doesn't want to connect. The card now has an X in its top-right corner: it closes any open connect window and lets the agent continue, telling it the user cancelled.
