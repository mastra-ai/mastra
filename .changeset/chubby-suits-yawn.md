---
'@mastra/server': minor
'@mastra/client-js': patch
'@mastra/react': patch
---

The `/agents/:agentId/stream` and `/agents/:agentId/resume-stream` endpoints now accept an `untilIdle` field in the request body. When set, the stream stays open across background-task continuations (same behavior as the `/stream-until-idle` endpoint). The dedicated `/stream-until-idle` and `/resume-stream-until-idle` endpoints remain available but are deprecated.

**Server example:**

```ts
// POST /api/agents/:agentId/stream
fetch(`/api/agents/${agentId}/stream`, {
  method: 'POST',
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Research solana for me' }],
    untilIdle: true, // or { maxIdleMs: 60000 }
  }),
});
```

**Client SDK:** `streamUntilIdle()` and `resumeStreamUntilIdle()` are deprecated — use `stream(messages, { untilIdle: true })` instead.
