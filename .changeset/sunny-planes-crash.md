---
'@mastra/server': patch
---

Accept the new `generateTitle` options in the serialized memory configuration schema: `minMessages` (minimum thread messages before a title is generated) and `emitEvent` (stream the generated title as a transient `data-thread-title` chunk before `finish`). `model` is now optional, matching the in-code configuration where the agent's own model is the default.

```typescript
const memoryConfig = {
  options: {
    generateTitle: {
      minMessages: 2,
      emitEvent: true,
    },
  },
};
```
