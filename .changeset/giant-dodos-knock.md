---
'@mastra/factory': patch
---

Trimmed what the Factory sidebar fetches while it polls.

The activity dots used to cost one request per user session every five seconds. They now share a single request whatever the sidebar holds, so ten sessions poll once instead of eleven times.

Work item responses also stop carrying `factoryRuleMaterializationKey`, an internal field no client reads and the heaviest one on a large board.
