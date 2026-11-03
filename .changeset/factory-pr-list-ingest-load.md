---
'@mastra/factory': patch
---

Fixed Factory pages loading slowly while boards poll the Review list. The open pull request list now runs the Factory rules at most once per page every 20 seconds, whichever board asked, instead of once per open board on every poll. A Work item that already records its open pull request is no longer rewritten on each poll, and boards that read the same project at the same moment now share one read of its cards.
