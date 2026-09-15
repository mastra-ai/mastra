---
'@mastra/factory': patch
---

Fixed integration feed publishers so an integration that implements `feedPublisher()` without `channels()` now receives work-item comment feed events. Previously the publisher was only wired for integrations that also provided a chat channel, so non-channel feed mirrors (webhooks, issue trackers) were silently never called.
