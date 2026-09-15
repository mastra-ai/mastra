---
'@mastra/factory': patch
---

Fixed the board search only matching intake candidates that were already loaded: `?q=21068` on the Review board showed nothing while pull request #21068 sat pages deep in the feed. The search now runs on the server through GitHub search (issues and pull requests, by number or title words) and the Linear issue filter (`ENG-123` or title words), so the first page already holds the matches. Cloud connections keep filtering what is loaded until the platform API gains a search route.
