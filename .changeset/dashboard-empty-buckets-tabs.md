---
'@mastra/playground-ui': patch
---

Fixed two dashboard rendering issues with trace and span data.

**Average, rate and percentile lines no longer drop to 0 where nothing happened.** A time bucket with no spans used to read 0 for every measure, so a P95 latency line fell to 0ms wherever an agent had no runs. Counts, sums and distinct counts still read 0 there; averages, rates and percentiles now leave the bucket without a value.

**Multi-view table, KPI and score cards no longer show a blank gap under their tabs.** When such a card sat beside a taller card in its row, the view tabs stretched to fill the spare height. The spare height now falls below the card's body.
