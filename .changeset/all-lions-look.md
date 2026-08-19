---
'@mastra/factory': minor
---

Added a pipeline funnel to the Factory overview, plus a readout for the work waiting to start.

The overview showed how much work finished and how long it took, but nothing about where work got stuck on the way there. The Pipeline block now reads a window's cards down the board — how many got at least as far as each stage, and, under each one, how many were abandoned there versus how many are still sitting there. Each card is counted once, at the furthest stage it ever reached, so the band only ever narrows and a card that skipped a stage still counts as having got past it. The note above it says how many of the cards pulled in that window shipped and how many came back for another pass.

The new "Waiting to start" readout counts the cards synced from GitHub or Linear that no run was ever started on. Every other figure on the page deliberately ignores those, since the integrations mirror far more issues than the Factory works on — which meant the standing queue was invisible. It now sits next to the rate that fills it ("8 of 20 filed this window picked up"), because a backlog only means something against the demand behind it.
