---
'@mastra/ai-sdk': major
---

`@mastra/ai-sdk` now emits AI SDK v7 messages and streams only. The `version` option is removed from `chatRoute`, `workflowRoute`, `handleChatStream`, `handleWorkflowStream`, `toAISdkStream`, and `toAISdkMessages`. `toAISdkV5Stream` and `toAISdkV5Messages` are removed.

```ts
// Before
toAISdkV5Messages(messages);
toAISdkStream(stream, { from: 'agent', version: 'v6' });
// After
toAISdkMessages(messages);
toAISdkStream(stream, { from: 'agent' });
```
