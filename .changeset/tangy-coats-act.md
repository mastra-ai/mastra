---
'@mastra/core': minor
---

Added Harness v1 admission evidence storage so storage adapters can make message and queue submissions idempotent.

**What's new**

- Detect duplicate message and queue admissions by `admissionId` and payload hash.
- Surface same-key conflicts before a request is executed twice.
- Store completed operations efficiently while preserving retry resolution.

```ts
const duplicate = await harnessStorage.resolveOperationAdmissionEvidence({
  sessionId,
  resourceId,
  threadId,
  kind: 'message',
  admissionId: 'send-message-1',
  attemptedAdmissionHash: hash,
});

if (duplicate.status === 'duplicate') {
  return duplicate.evidence;
}
```
