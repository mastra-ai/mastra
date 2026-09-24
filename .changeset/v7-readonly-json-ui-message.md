---
'@mastra/ai-sdk': patch
---

Fixed v7 helpers (`handleChatStream`, `chatRoute`, `toAISdkStream`, `toAISdkMessages` with `version: 'v7'`) rejecting `UIMessage` values from `ai@7.0.103` and later. These versions type `providerMetadata` with readonly JSON values, which the bundled v7 types did not accept. You no longer need to stay on `ai@7.0.102` or cast messages.
