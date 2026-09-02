---
'@mastra/factory': minor
---

Added `sandboxStart: 'eager' | 'lazy'` to `MastraFactoryConfig`. `'eager'` starts a session's sandbox as soon as its workspace is first resolved instead of on the agent's first command. Defaults to `'lazy'`.

```ts
new MastraFactory({
  sandbox: ctx => new PlatformSandbox({ id: ctx.sessionId }),
  sandboxStart: 'eager',
});
```
