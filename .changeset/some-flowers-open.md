---
'@mastra/playground-ui': patch
---

WorkflowClock takes a `spansSuspension` flag so a step duration that contains a suspension says so on hover instead of presenting waiting time as execution time. Durations across the workflow cards, run header and timeline now come from one shared `formatDuration` helper (`@mastra/playground-ui/utils/duration`), which scales past minutes so a run that waited two days reads `2d` instead of `172800000ms`.
