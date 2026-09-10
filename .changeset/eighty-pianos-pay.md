---
'@mastra/evals': patch
---

Fixed trajectory budget scorers that treated missing token or duration measurements as zero success, and counted nested model-generation usage toward token totals. Configured token budgets now require complete model measurements; duration budgets require a valid total or complete top-level durations. Incomplete evidence rejects via the existing scorer preprocessing error path instead of certifying a perfect score. (#23468)
