---
'@mastra/core': patch
---

Added an optional `project_id2` to server feature and model-usage telemetry while preserving existing project identifiers and usage cursors. UUID-shaped `MASTRA_PROJECT_ID` values are sent unhashed with an `mp_` prefix for direct Platform lookup. Other values fall back to a hash of the normalized Git `origin` remote, discovered asynchronously without blocking startup. The field is omitted when neither source is available.

These events are project-linked, not anonymous. Git-derived identifiers can also be matched against known repository URLs. Set `MASTRA_TELEMETRY_DISABLED=1` to disable telemetry and skip Git discovery.
