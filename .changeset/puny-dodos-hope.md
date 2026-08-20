---
'@mastra/factory': minor
---

Added a period-over-period change to the Factory overview's windowed figures.

A number on its own says where the Factory is, not whether it is getting better. Shipped, lead time, agent coverage and rework rate now each sit next to their change against the same span immediately before the window, colored by which direction is an improvement for that figure — so lead time falling reads as good and throughput falling does not. Rates move in points rather than percent, because 30% → 33% coverage is a three-point gain, not the "+10%" a relative reading would claim.

Each figure also carries its own shape over the window as a sparkline, so a headline and its trend can never disagree. A day nothing shipped leaves a gap in the lead-time line instead of a dip to zero — no completions is not the same as instant delivery.

The comparison appears only once the board covers both spans in full. On a younger board the missing days would read as growth from nothing, so no figure claims a trend at all.
