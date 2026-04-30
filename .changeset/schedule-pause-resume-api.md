---
'@mastra/server': patch
'@mastra/client-js': patch
'@mastra/playground': patch
---

Add a runtime pause/resume API for scheduled workflows so a misbehaving scheduled workflow can be stopped without a redeploy. New endpoints `POST /schedules/:id/pause` and `POST /schedules/:id/resume`, matching `client.pauseSchedule()` / `client.resumeSchedule()`, and a Pause/Resume button on the schedule detail page in Studio. Pause is durable across redeploys (the declarative-config upsert preserves user-set status). Resume recomputes `nextFireAt` from "now" so a long-paused schedule does not fire a backlog on resume.
