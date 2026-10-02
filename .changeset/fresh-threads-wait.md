---
'@mastra/code-sdk': minor
---

Added a `createInitialThread` option to `createMastraCode()`. Set it to `false` to start without a thread; the first message creates one, so a session that's never used leaves no empty thread behind. The default is unchanged.

```ts
createMastraCode({ createInitialThread: false });
```
