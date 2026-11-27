---
'@mastra/modal': minor
---

Fixed `clone({ idleTimeoutMinutes })` on `ModalSandbox` acting as a hard lifetime, which killed clones that many minutes after start even while a command was running. It now sets Modal's idle timeout, and the clone's `timeoutMs` is raised to at least the idle window. Fixes [#30369](https://github.com/mastra-ai/mastra/issues/30369).

Added an `idleTimeoutMs` option so a sandbox shuts down after a period without activity, while `timeoutMs` stays the hard limit.

```typescript
const sandbox = new ModalSandbox({
  timeoutMs: 60 * 60_000,
  idleTimeoutMs: 5 * 60_000,
});
```
