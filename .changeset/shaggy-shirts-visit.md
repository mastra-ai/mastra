---
'@mastra/factory': minor
---

Added board card detail endpoints for GitHub issues and pull requests (GET /web/github/projects/:id/issues/:number and /prs/:number) and for Linear issues (GET /web/linear/issues/:identifier?factoryProjectId=…, scoped to the sources bound to that Factory project). Each returns one item's metadata with its markdown description, so a board card can show the source description without bloating the list feeds.

**Card details open in place**

Clicking a card expands it over itself instead of opening a centered dialog, so you keep your place in the column. The panel carries the card's labels, stage, related cards, activity and the source's own description, with the same actions the card menu offers. It is as tall as what it holds — a card whose source has no description opens onto a short panel, and a description arriving from the fetch grows the box into place — and re-opening a card paints from cache. Everything the card already showed keeps its exact place while the box grows and folds back around it; only the description and the actions are staged in. A collapse button and the actions menu sit in the panel's top corner, and the main action spans the footer — which is “Open session” when the card already has one, instead of offering to start a duplicate.

**A faster board**

Boards with hundreds of cards no longer redraw all of them on every poll: each column renders a page of cards at a time and reveals the next as you scroll it, offscreen cards skip layout and paint, relationships between cards resolve in one pass instead of once per card, and the activity feed reads a bounded window of the audit trail rather than replaying the project's whole history on every visit.
