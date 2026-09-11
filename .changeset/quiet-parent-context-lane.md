---
'@mastra/memory': patch
---

Deliver reminder parent context as state snapshots and per-candidate deltas, avoiding new emissions when the visible state is unchanged. A check that changes one candidate sends its update instead of the whole filtered projection. Knowledge-node activity updates annotate the candidate's existing evidence without retransmitting its unchanged excerpt; folding instructions preserve the prior excerpt and matching state.
