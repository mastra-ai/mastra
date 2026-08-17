---
'@internal/factory-ui': patch
---

Stop showing "Linked card could not be filed" when nothing failed.

A linked-card decision that already succeeded is deliberately reset to `retry`
when its card is rematerialized, so the card gets re-filed. The board read any
`retry` as "already failed at least once" and put an error on the card, so a
routine replay looked like a broken automation — 16 cards were showing a failure
nobody caused.

A card now reports an error only when the effect has actually been attempted or
left an error behind. A replay reads as what it is: the work it is doing.
