---
'@mastra/factory': minor
---

When Platform credentials are set and you don't pass a `sandbox`, `MastraFactory` now picks one for you. Under `mastra dev` it runs sessions in a `LocalFactorySandbox`, so development no longer starts remote machines. Built deployments get a `PlatformFactorySandbox`. A `sandbox` you pass still takes precedence.

`LocalFactorySandbox` options are now optional. `root` defaults to `MASTRACODE_LOCAL_SANDBOX_ROOT`, or `~/.mastracode/web/sandboxes` when that is unset. `env` defaults to an allow-list of host variables, so git and TLS keep working while app secrets stay out of repository commands.

```ts
// Before: the host wired the Platform sandbox itself
new MastraFactory({ sandbox: new PlatformFactorySandbox() });

// After: omit it; local under `mastra dev`, Platform when built
new MastraFactory({});
```
