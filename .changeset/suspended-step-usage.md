---
'@mastra/core': patch
---

Fixed durable and evented streams dropping the suspending step's token usage. `usage` and `totalUsage` now settle when the run suspends for a tool call or an approval, including steps that already ran, and a resume still replaces those numbers with the cumulative total.
