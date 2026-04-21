---
'@mastra/core': patch
---

Fix tool execution errors being stored as successful results on history reload

When a tool's `execute()` threw an error, the error state was correctly shown during live streaming but was lost when loading from history. The `AIV5Adapter` now correctly handles `output-error` state in `toUIMessage`, `fromUIMessage`, and `fromModelMessage` conversions, preserving `errorText` through save/load cycles.
