---
'@mastra/factory': minor
---

Added a pipeline funnel to the Factory overview, and folded the two breakdowns that sat under it into the places they belong.

The overview showed how much work finished and how long it took, but nothing about where work got stuck on the way there. The funnel reads a window's cards down the board: how far each one got, and what every stage held on to. Each card is counted once, at the furthest stage it ever reached, so the flow only ever narrows and a card that skipped a stage still counts as having got past it.

Between two stages the flow narrows to whatever made it through, and the solid part is the share of that stage's passes an agent closed — so "nine in ten cards leave Planning on a person" is a shape you see rather than a number you look up. Each stage carries its own tint, so a flow is identifiable without reading back up to its label. What a stage kept peels off underneath, labelled with how much of it was abandoned and how much is still sitting there. Hovering or tabbing to a flow dims the rest and opens its figures: how many moved on, the agent share, the median and p90 time cards waited in the stage, and what stayed behind. Where cards travelled backwards a dashed arc runs back to the stage they returned to.

The agent share is read off each stage's passes rather than off the hops between stages. Cards routinely skip a stage — a card can go from Planning straight to Done — and a stage nobody hopped through records no hop at all, which made its flow render as "a person closed every one of these" when in truth nothing had been measured. The stage's own passes always have an answer, and it is the same number the Agent coverage figure at the top reports, so the two can no longer disagree.

That also removes the separate Agent coverage panel, which was answering the funnel's question a second time in a different unit. The source breakdown next to it becomes a "Picked up" figure in the top row, where the rest of the window's totals already sit.

Under the funnel sit the stage whose first visits take longest to leave, and what a card that comes back costs in extra stage time. Where work stops and where it lingers are different problems, and a redo count on its own reads as a tally — the hours it burns read as a cost.
