---
'@mastra/observability': patch
---

Fix SensitiveDataFilter destroying Date objects

The `deepFilter` method now correctly preserves `Date` objects instead of converting them to empty objects `{}`. This fixes issues with downstream exporters like `BraintrustExporter` that rely on `Date` methods like `getTime()`.

Previously, `Object.keys(new Date())` returned `[]`, causing Date objects to be incorrectly converted to `{}`. The fix adds an explicit check for `Date` instances before generic object processing.

