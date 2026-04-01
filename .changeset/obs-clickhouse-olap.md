---
'@mastra/clickhouse': minor
---

Added a new ClickHouse `v-next` observability adapter with support for traces, logs, metrics, scores, and feedback.

This release includes trace listing and reconstruction, list and lookup operations across supported observability signals, retention helpers, and OLAP-style analytics queries for metrics, scores, and feedback, including aggregates, breakdowns, time series, and percentiles.

It also adds support for broader observability context fields such as entity hierarchy, correlation IDs, deployment metadata, and execution source.
