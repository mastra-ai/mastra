---
'mastra': patch
---

Fixed Studio's channel connect flows opening tabs they shouldn't and missing completions:

- Connecting Slack now continues in the current tab (its flow redirects back to Studio), instead of leaving a stale Studio copy behind in a new tab.
- Connecting Discord opens the invite in a new tab and no longer dead-ends when the popup blocker intervenes — it falls back to navigating the current tab.
- While a Discord invite is in flight, returning to Studio now checks whether it completed and flips the agent to "Connected" without a manual refresh.
