---
'@mastra/core': minor
'mastracode': minor
---

Added experimental MastraCode GitHub PR notifications, including opt-in `/settings` support, `/github subscribe|unsubscribe|sync|pending` commands, PR status badges, shared LibSQL-backed notification polling, and agent signals for PR comments, reviews, CI failures, merges, closures, and real merge conflicts.

Notifications are coordinated across local MastraCode instances with a durable GitHub inbox and PR snapshot cache plus a master polling lease, queued while a thread is active, and delivered after the active response finishes or via `/github pending`. GitHub PR notification status reads now use REST-only snapshots for polling, `/github subscribe` summaries, and current-branch PR discovery instead of GraphQL-backed `gh pr view` fields. Automatic snapshot refreshes use one leader-gated PR snapshot loop with separate freshness gates: lightweight PR state and CI check refreshes run more often for conflict/merge/close/CI signals while heavier review fallback refreshes stay on the slower cadence. Manual `/github sync` still refreshes immediately through the same REST snapshot path. Example: `/github subscribe mastra-ai/mastra#16515` then `/github pending`.
