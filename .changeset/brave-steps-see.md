---
'@mastra/core': minor
---

`processLLMRequest` now receives the workspace of the step, the one the agent's tools use, so a processor can work with the agent's sandbox or filesystem before a model call.

```ts
const processor: Processor = {
  id: 'my-processor',
  async processLLMRequest({ prompt, workspace }) {
    if (workspace?.hasSandboxConfig()) {
      // ...
    }
  },
};
```
