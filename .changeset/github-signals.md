---
'@mastra/core': minor
'mastracode': minor
---

Added experimental MastraCode GitHub PR notifications, including opt-in `/settings` support, `/github subscribe|unsubscribe|sync|pending` commands, PR status badges, shared LibSQL-backed notification polling, and agent signals for PR comments, reviews, CI failures, merges, closures, and real merge conflicts.

Notifications are coordinated across local MastraCode instances with a durable GitHub inbox and PR snapshot cache plus a master polling lease, queued while a thread is active, and delivered after the active response finishes or via `/github pending`. Automatic snapshot refreshes are leader-gated and cached so multiple local instances do not each re-check the same subscribed PR; lightweight PR state refreshes run more often for conflict/merge/close signals while heavier review/check fallback refreshes stay on the slower cadence. Manual `/github sync` still refreshes immediately. Example: `/github subscribe mastra-ai/mastra#16515` then `/github pending`.
