---
'@mastra/code-sdk': patch
---

Added a local boot option to defer initial thread creation until the client selects or creates a thread:

```ts
createMastraCode({ createInitialThread: false });
```
