---
'@mastra/factory': patch
---

Thread pages fetch the conversation again only when the live stream actually missed something. A run the stream delivered from start to end, or a reconnect after a quiet hidden tab, no longer re-reads the newest 100 messages.
