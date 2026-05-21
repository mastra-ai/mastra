---
'@mastra/core': minor
'mastracode': minor
---

Added experimental MastraCode GitHub PR notifications, including opt-in `/settings` support, `/github subscribe|unsubscribe|sync|pending` commands, PR status badges, shared LibSQL-backed notification polling, and agent signals for PR comments, reviews, CI failures, merges, closures, and real merge conflicts.

Notifications are coordinated across local MastraCode instances with a durable GitHub inbox cache and master polling lease, queued while a thread is active, and delivered after the active response finishes or via `/github pending`. Example: `/github subscribe mastra-ai/mastra#16515` then `/github pending`.
