---
'@mastra/core': patch
---

Memory now throws a clear error when observational memory is enabled on a storage adapter that doesn't support it (for example Cloudflare D1). Previously the agent ran without saving or recalling any messages and logged nothing.

To fix the error, switch to a storage adapter that supports observational memory, or turn observational memory off. If you also pass an observational-memory processor to your agent, remove it:

```ts
// Before
const memory = new Memory({ storage: d1Store, options: { observationalMemory: true } });
const agent = new Agent({ memory, inputProcessors: [omProcessor], outputProcessors: [omProcessor] /* ... */ });

// After
const memory = new Memory({ storage: d1Store, options: { observationalMemory: false } });
const agent = new Agent({ memory /* ... */ });
```
