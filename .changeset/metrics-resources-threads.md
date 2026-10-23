---
'@mastra/playground-ui': minor
---

Added a **Resources and threads** card to the Metrics page. It charts distinct resources and threads with traces over time, with each id's total for the whole range in the legend, and adds users and sessions when your traces set `userId` or `sessionId`. Ids your traces don't set are left out rather than drawn as flat lines. Click a bucket to open its traces.

The card appears when your observability storage supports both trace and span aggregation (ClickHouse, Postgres and DuckDB today); other storage keeps the page as it was. It shows a message instead of data when a page filter has no trace equivalent.

`DistinctIdsCard` is exported from `@mastra/playground-ui/domains/metrics/components` and takes its drilldown as a callback prop, so other apps can place it on their own Metrics pages inside a `MetricsProvider`.
