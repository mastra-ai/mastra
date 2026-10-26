---
'@mastra/factory': minor
'mastra': patch
---

A pull request now joins the card it belongs to instead of getting a card of its own. Factory's own pull requests link to the card that opened it, and a pull request whose description says "fixes #42" links to issue 42's card; the card's review seat reviews it, pushes re-review it, and the merge moves the card to Done. A pull request from someone without write access is only linked until a maintainer requests Factory's review. At boot, existing pull request cards Factory opened are folded into their cards.
