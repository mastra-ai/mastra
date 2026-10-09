---
'@mastra/react': patch
---

`useModelUsageCostMetrics` now groups usage by model and provider, and each row includes an optional `provider` field. A model served by more than one provider (for example `gpt-4o` through OpenAI and Azure) now shows up as separate rows instead of being merged.
