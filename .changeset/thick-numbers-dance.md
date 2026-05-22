---
'@mastra/core': patch
---

Loosened `MASTRA_TELEMETRY_DISABLED` check to accept any truthy value. Previously only the literal string `'1'` disabled enterprise telemetry, meaning common values like `true` or `yes` silently kept telemetry on. The CLI and Studio playground already used truthy-string semantics; this aligns enterprise telemetry with the rest of the framework.

**Before:** `MASTRA_TELEMETRY_DISABLED=true` did not disable enterprise telemetry — only `MASTRA_TELEMETRY_DISABLED=1` did.

**After:** Any non-empty value (`true`, `1`, `yes`, etc.) disables enterprise telemetry, matching CLI behavior.
