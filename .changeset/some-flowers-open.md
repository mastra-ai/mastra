---
'@mastra/playground-ui': patch
---

`WorkflowClock` takes a `spansSuspension` flag so a step duration that contains a suspension says so on hover instead of presenting waiting time as execution time. It formats through a shared `formatDuration` helper (`@mastra/playground-ui/utils/duration`) that scales past minutes, so a step that waited two days reads `2d` instead of `172800000ms`.
