---
'@mastra/factory': minor
---

Reworked the Factory traces page around the cursor.

Each card is a row and its length is time. Hovering one now carries a panel alongside the pointer with the card, its ids, and — over a stage bar — how long that stage held it and what moved it on; clicking pins the panel so it can be read without holding the mouse still. Rows arrive in reading order on load, a card under an agent keeps a slow pulse, and the stage under the cursor lifts out of the row while the rest stays quiet.

Board occupancy now opens the page as a gradient-filled stacked area chart instead of a block of monospace below the rows: hover anywhere across it to read how many cards each stage was holding at that moment, on a guide line that tracks the cursor. It shares the rows' time axis, so a spike in the chart sits directly above the cards that caused it.

**Fixed** — the occupancy chart emptied itself at the right edge. A card still sitting in a stage was read as leaving at that instant, so every window ended in a drop to zero that never happened.
