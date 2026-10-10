---
'@mastra/core': minor
---

Memory can now contribute error processors to an agent. `MastraMemory.getErrorProcessors()` works like `getInputProcessors()` and `getOutputProcessors()`: the agent appends what it returns to its resolved `errorProcessors`, on both regular and durable agents. These processors run after configured and default error processors, and stay in place when a call passes its own `errorProcessors`. The base implementation returns none, so existing memory classes are unaffected.

```ts
class MyMemory extends MastraMemory {
  async getErrorProcessors() {
    return [new MyRecoveryProcessor()];
  }
}
```
