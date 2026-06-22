---
'@mastra/github-signals': minor
---

Added multi-PR GitHub signal tools and improved notification filtering.

Agents can subscribe to multiple pull requests, unsubscribe from multiple pull requests, and unsubscribe from all tracked pull requests. GitHub signal notifications now also filter repeated low-value bot comments such as skipped CodeRabbit reviews and bot status summaries.
