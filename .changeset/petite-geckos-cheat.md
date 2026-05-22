---
'@mastra/core': patch
'mastra': patch
---

Fixed telemetry opt-out detection for `MASTRA_TELEMETRY_DISABLED`.

`1`, `true` and `yes` now disable telemetry (case-insensitive).
This prevents telemetry from being sent when users set common opt-out values.
