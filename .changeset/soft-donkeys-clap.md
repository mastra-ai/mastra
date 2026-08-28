---
'@mastra/factory': minor
---

Commenting on a work item now notifies everyone already in that discussion, not just the people it names. Participants land in a separate `activity` tier of `GET /web/factory/projects/:id/attention`, counted apart under `activityOpenCount`/`activityUnreadCount` so the notification badge and sound stay reserved for mentions and failures.
