---
'@mastra/factory': minor
---

Commenting on a work item now notifies everyone already in that discussion, not just the people it names. Participants land in a separate `activity` tier of `GET /web/factory/projects/:id/attention`, counted apart under `activityUnreadCount` so the notification badge and sound stay reserved for mentions and failures. The attention inbox also refreshes while open now: comment-driven entries arrive over the feed stream, and the list polls every 5s for the rest. The sidebar popover asks the server for the badge tier (`?tier=badge`), so busy discussions can no longer crowd mentions and failures out of its five slots.
