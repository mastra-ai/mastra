---
'@mastra/factory': patch
---

Board search and the search palette now find cards by a pasted link. Paste a GitHub, GitLab, Linear or Jira link and you get the card that carries that issue or pull request, including an issue's card when the pull request is attached to it. The rest of the link, such as `/files`, `?tab=checks` or a comment anchor, does not matter, and neither does its case. A link without `https://` works too.

- A repository or project link lists the cards it holds.
- A Factory card link finds that card.
- A branch name or card id, pasted whole, finds its card.
- The number or key of an attached pull request (`acme/app#307`) finds the issue's card.

Search still runs on the server against per-card data that is computed once, and a link is parsed once per search, so a search costs about the same as before.
