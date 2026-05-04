---
'@mastra/playground-ui': minor
---

Added Studio UI for scheduled workflows.

- `/workflows/schedules` lists every schedule across the project with the most recent run's status. Append `?workflowId=<id>` to filter to a single workflow.
- `/workflows/schedules/:scheduleId` shows the schedule's metadata, Pause/Resume controls, and paginated trigger history. Each trigger is deep-linked to its workflow run graph. The view polls every five seconds while any fired run is still active.
- A workflow's detail header shows a Schedules action when it has at least one schedule.
