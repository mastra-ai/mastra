---
'@internal/playground': patch
---

Fix workflow run Timeline rows not being sorted by start time in Studio. `buildTimeline` now orders rows by `startedAt` ascending (with a stable `stepId` tiebreak), so each row's vertical position matches its horizontal bar. Nested steps remain visible through indentation.
