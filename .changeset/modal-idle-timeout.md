---
'@mastra/modal': patch
---

Added an `idleTimeoutMs` option and fixed `clone({ idleTimeoutMinutes })`, which used to set the sandbox's hard wall-clock lifetime instead of an idle window — so `clone({ idleTimeoutMinutes: 1 })` killed the sandbox one minute after it started, even mid-command.

`idleTimeoutMs` terminates the sandbox after that long without activity instead of letting it run to `timeoutMs`. It is unset by default, so nothing changes unless you ask for it.

`clone({ idleTimeoutMinutes })` now sets `idleTimeoutMs` and raises the clone's `timeoutMs` to at least the requested window, so the idle timeout can actually be reached:

```typescript
// before: the clone was killed 1 minute after it started
const child = template.clone({ idleTimeoutMinutes: 1 });

// after: the clone idles out only after 1 minute without activity,
// and its lifetime is raised to match
const child = template.clone({ idleTimeoutMinutes: 1 });
```

To keep a hard wall-clock cap on a sandbox, set `timeoutMs` when you construct it rather than relying on `clone({ idleTimeoutMinutes })`.

When `timeoutMs` is not set it now defaults to the larger of 5 minutes and `idleTimeoutMs`, so an idle window longer than 5 minutes is not silently cut short.
