---
'@mastra/core': patch
---

Added an option to defer initial thread creation until a client selects or creates a thread:

```ts
controller.createSession({ createInitialThread: false });
```
