---
'@mastra/factory': patch
---

Fixed "Linked card could not be filed: A work item cannot relate to itself" on Review cards. When GitHub polling re-observed a pull request that already had a card, the dispatcher tried to link the card to itself as its parent.
