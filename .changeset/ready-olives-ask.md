---
'@mastra/factory': minor
---

Added a default sandbox to `MastraFactory`. Before, omitting `sandbox` disabled repository sandboxes, so every session with a repository failed with "A sandbox is required". Now `prepare()` picks one for you:

- The Mastra Platform sandbox when `MASTRA_PLATFORM_ACCESS_TOKEN` or `MASTRA_PLATFORM_SECRET_KEY` is set together with `MASTRA_PROJECT_ID` and `MASTRA_ENVIRONMENT_ID`.
- Otherwise a local sandbox on the host under `~/.mastracode/factory/sandboxes`. Commands receive only `PATH` and a short allowlist of host variables (such as `HOME`), never server secrets. Factory logs a warning at boot when it falls back to the local sandbox.

A sandbox you pass explicitly is still used as-is. With a Platform credential and project but no `MASTRA_ENVIRONMENT_ID`, Factory still installs its Platform integrations while sessions use the local sandbox.

```ts
// Before: sessions with a repository failed. Now: Platform sandbox or a local sandbox
const factory = new MastraFactory({ storage });

// Choose the sandbox yourself (recommended for production)
const factory = new MastraFactory({
  storage,
  sandbox: new PlatformFactorySandbox(),
});
```
