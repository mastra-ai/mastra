---
"@mastra/core": patch
"@mastra/libsql": patch
---

Added retry-safe `session.message()` admission for Harness v1 using the `admissionId` parameter.

Non-stream calls now fail when terminal evidence cannot be saved durably.
Streaming calls still return live output, and terminal evidence is saved in the background.
Non-idempotent follow-up writes remain best-effort after dispatch.
Retries with the same hash are treated as duplicates, which avoids caller-visible conflicts during live runs.

```ts
await session.message({ content: 'Summarize this issue', admissionId: 'msg-123' });
await session.message({ content: 'Summarize this issue', admissionId: 'msg-123' }); // duplicate retry
```
