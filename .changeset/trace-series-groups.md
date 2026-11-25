---
'@mastra/playground-ui': patch
---

Fixed dashboard chart series over grouped Traces and Spans queries. A series now reads only the groups it picks (or every group but those it leaves out), named like metrics series: the query's `groupBy` values joined by `|`, with `''` for a missing value. Before, every group's rows were added into one line whatever the series picked.

Charts also now report a series that adds up every group of a measure that can't be added up (averages, percentiles, minimums, maximums, error rates, distinct counts), as they already did for metrics; pick one group instead.
