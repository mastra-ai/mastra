---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
---

AgentController `steer` and `followUp` now accept file attachments, matching `sendMessage`. Attached files reach the model the same way whether the message is sent right away or queued behind an active run.

```typescript
await session.followUp({
  content: 'Then compare against this screenshot.',
  files: [{ data: screenshotBase64, mediaType: 'image/png', filename: 'expected.png' }],
});
```

The `/steer` and `/follow-up` routes accept the same `files` field and limits as `/messages`.
