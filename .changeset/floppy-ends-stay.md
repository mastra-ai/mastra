---
'@mastra/factory': minor
---

Added a "Waiting on a person" list to the Factory overview, reachable from every other page.

The queue-health chart says how much work is aging and where, but not what to do about it. The list names the cards themselves, worst first, and says why each one is stopped: it came back for another pass, a reviewer owes it an answer, nobody has picked it up, or an agent has been on it long enough to be worth a look. Cards still inside their first age threshold are left out — waiting is only news once it lasts.

The sidebar carries the same count and opens the same list in a popover, so the number reaches you on a page you are not looking at. It is a window onto the board rather than an inbox: nothing to read or dismiss, so the count can never drift from what the board actually holds.

The list and the chart read the same aged snapshot, so a card cannot be critical in one and absent from the other.
