---
'@mastra/modal': minor
---

Fixed `clone({ idleTimeoutMinutes })` on `ModalSandbox` killing the sandbox clone that many minutes after it started, even while a command was running. It now sets an idle timeout, so the clone also shuts down after that long without activity. The clone's hard lifetime is the larger of the template's `timeoutMs` and the idle window, and it applies even while a command runs. To let a busy clone run past the idle window, give the template a `timeoutMs` longer than that window. Fixes [#30369](https://github.com/mastra-ai/mastra/issues/30369).

Added an `idleTimeoutMs` option to `ModalSandbox` so a sandbox can shut down when it goes unused, while `timeoutMs` stays the hard upper limit. It is off by default, so existing sandboxes behave as before.

```typescript
const sandbox = new ModalSandbox({
  timeoutMs: 60 * 60_000, // never runs longer than 1 hour
  idleTimeoutMs: 5 * 60_000, // terminated after 5 idle minutes
})
```
