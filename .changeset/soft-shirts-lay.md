---
'@mastra/factory': patch
'mastra': patch
---

Fixed Factory starting a card's session in a repository the card doesn't come from. When a card's repository wasn't linked to the Factory, the draft started the session in the first linked repository and wrote that repository onto the card. The draft now asks the server which repository the card's session uses, and when there is none it shows why, for example "Source-control repository acme/docs is not linked to this Factory.", starts nothing, and links to repository settings. When the lookup itself fails, the draft offers Retry.

A card from GitHub in a Factory whose repositories are all on GitLab, or the reverse, is now refused the same way instead of starting in that Factory's repository, even when a repository there has the same name.

`mastra api factory work-item session-repository <project-id> <work-item-id>` shows the same answer from the CLI.
