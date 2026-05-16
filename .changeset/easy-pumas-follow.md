---
'@mastra/core': minor
---

Enterprise edition now automatically captures PostHog telemetry for EE license checks and feature usage, including license validation status, RBAC access resolution, FGA authorization calls, and EE feature invocation metadata. Telemetry is enabled by default for EE customers and can be disabled with `MASTRA_TELEMETRY_DISABLED=1`; community users are unaffected.
