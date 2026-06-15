---
'@mastra/github-signals': patch
---

Fixed GitHub PR subscription failing with 'sendNotificationSignal requires a notifications storage domain' when using GithubSignals via the Agent signals config. The connected agent now receives the Mastra instance so notification delivery has storage access.
