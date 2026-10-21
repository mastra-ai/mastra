---
'@mastra/factory': patch
---

Failed run reports now quote the model provider's own reason for any provider failure, not only usage limits. For example, a report says `prompt is too long: 210345 tokens > 200000 maximum` instead of `Bad Request`.
