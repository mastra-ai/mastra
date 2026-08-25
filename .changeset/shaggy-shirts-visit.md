---
'@mastra/factory': minor
---

**Card details open in place**

Clicking a board card expands it over itself instead of opening a centered dialog, so you keep your place in the column. The panel carries the card's labels, stage, related cards, activity and the source's own description — the GitHub issue or pull request body, the Linear issue description — with the same actions the card menu offers. It is as tall as what it holds, so a card whose source has no description opens onto a short panel and a description arriving from the fetch grows the box into place; re-opening a card paints from cache. Everything the card already showed keeps its exact place while the box grows and folds back around it; only the description and the actions are staged in. A link to the card's source, a collapse button and the actions menu sit in the panel's top corner, and the main action spans the footer — which is “Open session” when the card already has one, instead of offering to start a duplicate.

Descriptions are read through the Factory server with the org's own GitHub installation and Linear connection, scoped to the sources bound to that Factory project, so no provider token reaches the browser and a board only ever reads its own sources.

**A faster board, and a way to search it**

Boards with hundreds of cards no longer redraw all of them on every poll: each column renders a page of cards at a time and reveals the next as you scroll it, offscreen cards skip layout and paint, relationships between cards resolve in one pass instead of once per card, and the activity feed reads a bounded window of the audit trail rather than replaying the project's whole history on every visit.

Because a column now shows a page at a time, the board filter bar carries a search: type a card's title or its issue key (`#812`, `ENG-42`) and matching cards surface however deep they sat. It narrows before the paging, composes with the teammate and label filters, and lives in the URL (`?q=`), so a narrowed board is a link you can share.
