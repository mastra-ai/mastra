---
'@mastra/platform-workspace': minor
---

Added `clone()` support to `PlatformSandbox`. `clone()` constructs an unstarted sibling sandbox that inherits the template's configuration (access token, project, environment, network isolation, timeout, instructions, env, idle timeout) with per-instance overrides for `id`, `sandboxId`, `env`, and `idleTimeoutMinutes`, so one configured sandbox can act as a template for a fleet of sandbox clones (for example, one per project).

```ts
const template = new PlatformSandbox({
  accessToken,
  projectId,
  environmentId,
});

const projectSandbox = template.clone({
  id: 'mc-project-42',
  env: { GITHUB_TOKEN: token },
  idleTimeoutMinutes: 30,
});
await projectSandbox.start();
```

This brings `PlatformSandbox` up to parity with the other sandbox providers (`@mastra/railway`, `@mastra/e2b`, `@mastra/daytona`, `@mastra/modal`, `@mastra/docker`, `@mastra/blaxel`, `@mastra/apple-container`, `@mastra/vercel`) so it can be used with `MastraFactory` fleets and the MC Web factory.
