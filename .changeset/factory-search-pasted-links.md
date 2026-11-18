---
'@mastra/factory': patch
---

Board search and the search palette now find cards by a pasted link. Paste a GitHub, GitLab, Linear or Jira link and you get the card that carries that issue or pull request, including an issue's card when the pull request is attached to it. The rest of the link, such as `/files`, `?tab=checks` or a comment anchor, does not matter, and neither does its case. A link without `https://` works too.

- A repository or project link lists the cards it holds.
- A Factory card link finds that card.
- A branch name or card id, pasted whole, finds its card.
- The number or key of an attached pull request (`acme/app#307`) finds the issue's card.
- `#12` and `acme/app#12` now find number 12 only, not `#123`. Bare digits (`12`) still find every number that contains them.

```
GET /web/factory/projects/:id/boards/:boardKey/phases?q=https%3A%2F%2Fgithub.com%2Facme%2Fapp%2Fpull%2F307%2Ffiles
```

The board, the palette, the `factory_list_work_items` agent tool and the MCP `search` tool now use the same search, so a card one of them finds, the others find too. Search still runs on the server against per-card data that is computed once. Searches that differ only in case or spacing now share one request and one cached answer.
