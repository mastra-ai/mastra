---
'@mastra/factory': patch
---

Factory pull requests, comments and reviews now credit the person who started the run, not the account it runs as. When someone approves, starts or moves a card, the Factory records that person on the card's run. That credit carries over to later phases, wake-ups and side sessions.

Runs that nobody started (webhook or rule starts) are credited to the Factory and no longer to an internal id, the Factory's creator or the repository connector. A person working in a Factory session still gets the credit for their own changes. Repository access and credentials still come from the account the run uses.
