---
'@mastra/core': patch
---

Added `byUser` to the `approved` channel tool display event, matching `denied`. A custom `toolDisplay` function can now show who approved a tool call (for example "Approved by Alice"), not only who denied it. The default approved card also names the approving user. `byUser` is undefined in DMs.

```ts
toolDisplay: event => {
  if (event.kind === 'approved') {
    return { kind: 'post', message: `Approved by ${event.byUser ?? 'you'}` };
  }
};
```
