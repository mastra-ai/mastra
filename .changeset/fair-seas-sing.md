---
'@mastra/client-js': minor
---

Improved the Mastra A2A client to feel closer to the official A2A SDK without introducing a breaking change.

- Added official-style A2A methods such as `getAgentCard()`, `sendMessageStream()`, `getExtendedAgentCard()`, and `getTaskPushNotificationConfig()`.
- Added typed A2A stream consumption for `sendMessageStream()` and `resubscribeTask()`.
- Kept older methods available as deprecated compatibility methods, including `getCard()` and `sendStreamingMessage()`.
