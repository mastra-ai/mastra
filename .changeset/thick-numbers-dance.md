---
'@mastra/core': patch
'mastra': patch
---

Fixed `MASTRA_TELEMETRY_DISABLED` opt-out detection. The values `1`, `true`, and `yes` (case-insensitive, trimmed) now reliably disable telemetry in both `@mastra/core` enterprise events and the `mastra` CLI's PostHog analytics.

Previously, `@mastra/core` only treated the literal string `'1'` as disabled, so common opt-out values like `MASTRA_TELEMETRY_DISABLED=true` silently kept telemetry on.

The `mastra` CLI's `PosthogAnalytics` constructor now also short-circuits when telemetry is disabled — no disk I/O, no tracking ID generation, no PostHog client. Previously the config file (`mastra-cli.json`) was written even when telemetry was disabled.

**Example:**

```bash
# .env — any of these now reliably disable telemetry
MASTRA_TELEMETRY_DISABLED=true
MASTRA_TELEMETRY_DISABLED=1
MASTRA_TELEMETRY_DISABLED=yes
```
