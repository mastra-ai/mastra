---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/playground': minor
---

Schedules UI in Studio now surfaces the real workflow run that each schedule fire produced. The `/schedules` and `/schedules/:id` endpoints hydrate the schedule's `lastRun` with a status, start, end, and duration; `/schedules/:id/triggers` hydrates each trigger with its corresponding run's status and error. Studio's schedules table swaps the "Last fire" column for "Last run" with a run-status badge, and the trigger panel becomes a runs list with deep links to each run's graph view. The triggers panel polls every five seconds while any fired run is still active.
