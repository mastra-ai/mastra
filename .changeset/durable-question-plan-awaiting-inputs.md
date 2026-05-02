---
'@mastra/core': patch
---

Harness now lets developers discover and resume durable `ask_user` questions and `submit_plan` approvals with `listAwaitingInputs()` and `resumeAwaitingInput()`.

```ts
const [input] = await harness.listAwaitingInputs();
await harness.resumeAwaitingInput({ id: input.id, resumeData: 'Yes, continue' });
```
