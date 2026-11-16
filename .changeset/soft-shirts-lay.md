---
'@mastra/factory': patch
'mastra': patch
---

Fixed Factory starting a card's session in a repository the card doesn't come from. When a card's repository wasn't linked to the Factory, the draft started the session in the first linked repository and wrote that repository onto the card. The draft now asks the server which repository the card's session uses, and when there is none it shows why, for example "Source-control repository acme/docs is not linked to this Factory.", and starts nothing.
