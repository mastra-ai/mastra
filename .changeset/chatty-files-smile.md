---
'@mastra/playground-ui': patch
---

Improved bar charts: a time bucket that counted zero now shows a short neutral stub instead of an empty space, so a quiet stretch reads as "nothing happened" and not as missing data. Buckets without data (left out or `null`) and buckets that have not started yet stay empty.

Applies to every `MetricsStackedBarChart`, including the Metrics cards, dashboards and the Traces and Spans histograms.
