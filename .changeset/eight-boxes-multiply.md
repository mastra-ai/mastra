---
'@mastra/railway': minor
'@mastra/e2b': minor
'@mastra/daytona': minor
'@mastra/modal': minor
'@mastra/docker': minor
'@mastra/blaxel': minor
'@mastra/apple-container': minor
'@mastra/vercel': minor
---

Added `derive()` support to the sandbox providers. `derive()` constructs an unstarted sibling sandbox that inherits the template's configuration (credentials, image, resources) with per-instance overrides for `id` and `env`, so one configured sandbox can act as a template for a fleet of sandboxes (for example, one per project).

```ts
const template = new E2BSandbox({ apiKey, template: 'base' });

const projectSandbox = template.derive({
  id: 'mc-project-42',
  env: { GITHUB_TOKEN: token },
  idleTimeoutMinutes: 30,
});
await projectSandbox.start();
```

`idleTimeoutMinutes` is a best-effort hint that maps to each provider's native lifetime knob (Railway `idleTimeoutMinutes`, E2B/Modal/Vercel timeout in milliseconds, Daytona `autoStopInterval`, Blaxel TTL duration). Docker and Apple Container ignore it since they have no provider-side idle teardown.
