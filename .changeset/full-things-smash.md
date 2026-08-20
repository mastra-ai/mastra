---
'@mastra/factory': minor
---

Made the Factory overview say which board each figure is counted on, and drew what it used to spell out.

Delivery, the funnel, review threads and the live board sit on one page but are counted on different populations. Each section now carries the board it reads — work, review, or both — so a lead time of two days and a time to review of twenty minutes stop looking like a contradiction.

**Where time pools is drawn, not narrated**

The funnel used to end in a sentence naming its slowest stage. Every stage now carries its own median under the flow that leaves it, the slowest one picked out, so the eye finds where work sits without reading a line of prose. Hovering a gate says how many cards got that far and how many are still there; hovering a flow adds that stage's median and p90 and the share an agent closed. The rework figure moved onto the send-back arrow it belongs to: `1 sent back · +3h each`.

The metrics endpoint reports `stageDwell` — median and p90 per stage — in place of `slowestStage`, which was the same measurement with everything but the maximum thrown away.

**The review board gets its own chart**

Reviews per day now has a trend line, and demand versus pickup is a bar reading `198 picked up` against `801 filed`, in place of the sentence that said it. Its per-day rate is read over the review board's own covered days rather than the work board's.
