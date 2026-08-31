---
'@mastra/factory': minor
---

Rebuilt the Factory Overview at `/factories/:id/overview` around what needed a person and what the Factory shipped, and gave board traffic its own page.

**The page opens on a stage funnel** for the work created in the selected window (7, 30 or 90 days), each card placed by the furthest stage it ever reached rather than by where it sits today.

- The saturated core is what got that far with nobody stepping in, the pale sheath what a person had to close. Moves made by Factory rules count as unattended, so the autonomy figures no longer bill automation to a person.
- Every loss peels off as its own hatched arm, billed to the column the work actually stopped in, so a drop keeps the thickness it cost instead of turning into whitespace.
- Each column carries its typical hold. Hovering one says how much of it ran hands-off, what it lost since the column before, and what landed as a merged pull request; hovering an arm says how much stopped there and whether it was called off, still holding the column, or left without a decision.
- The first rung reads Entered, not Intake: that board column also holds live GitHub and Linear candidates with no work item behind them, which the page cannot count.
- Pull requests the Factory reviewed are counted beside the funnel — a count and only a count, since whether they went on to merge is the team's decision rather than the Factory's work.

**Why reach and not time-to-ship.** On a real board almost nothing that lands in Done has passed through Execute and Review: Done is where cards get closed, not where work lands. A "shipped in this window, this fast, this hands-off" figure reads off that same history and cannot stand behind any of the three. Reach can, from the same records, so that is what the page reports.

Under the funnel: what is stalled, what is running now, the latest commits, and a preview of activity and of what needs you.

**Board traffic has its own Activity page** at `/factories/:id/activity`, reading as a rail cut by day. It shows everything the Factory did, not only stage moves — the board's own stage history for the moves, and the audit trail for the runs started, commits, pushes and comments a move is not, two sources that never describe the same fact.

- Each entry reads as a sentence: who acted, what they did, which card, hung off a coloured bead on one continuous rail.
- A card walked through several stages by one actor folds into a single chain instead of repeating its title, and neighbours saying the same thing about a different card become one sentence with those cards listed in a panel under it.
- Days are cut by a ruled heading and each row carries its minute on the right edge, so a screenful reads as prose down the middle rather than as a column of timestamps.

**The attention inbox and the rule effects page now read on that same rail** — cut by day, each row hanging off the mark of what it is (the kind of message, or the status of the effect) and carrying its time on the right edge, so the three pages are one surface instead of three list styles. The attention inbox also paginates like they do: older items load as the list is scrolled instead of waiting on a click.

**Every page opens at its top.** The data router carried the window scroll across navigations, so leaving a scrolled Overview landed on Activity halfway down it.
