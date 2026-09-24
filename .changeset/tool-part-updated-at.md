---
'@mastra/core': patch
---

Tool invocation parts now record `updatedAt` whenever their state changes (approval response, result, error), and `tool-call-approval` chunks carry the matching `updatedAt`. Compare them to tell whether a streamed approval is newer than the stored tool call.

```ts
for await (const chunk of subscription.stream) {
  if (chunk.type !== 'tool-call-approval') continue;
  const stored = storedParts.get(chunk.payload.toolCallId);
  if (stored?.updatedAt && chunk.payload.updatedAt <= stored.updatedAt) continue; // already stored
  promptForApproval(chunk);
}
```
