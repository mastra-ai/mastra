---
'@mastra/server': patch
---

Added route-level and thread-level FGA enforcement for server handlers, memory APIs, and protected custom routes.

This closes authorization gaps where callers could access detail endpoints by ID, custom-route FGA checks could miss path parameters, or memory thread filtering could leak unviewable totals and pagination metadata.
