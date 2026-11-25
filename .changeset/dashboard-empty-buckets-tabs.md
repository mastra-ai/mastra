---
'@mastra/playground-ui': patch
---

Fixed two dashboard rendering issues with trace and span data.

**Charts leave a gap where nothing happened, for averages, rates and percentiles.** A time bucket with no spans used to be drawn as 0 for every measure, so a P95 latency line dropped to 0ms wherever an agent had no runs. Counts, sums and distinct counts still read 0 there; averages, rates and percentiles now leave the bucket empty.

**Multi-view table, KPI and score cards no longer show a blank gap under their tabs.** When such a card sat beside a taller card in its row, the view tabs stretched to fill the spare height. The spare height now falls below the card's body.
