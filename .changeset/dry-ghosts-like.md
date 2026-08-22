---
'@mastra/platform-workspace': minor
---

Added asynchronous sandbox template builds, reusable template handles, and lazy repository templates for Platform workspaces. `PlatformSandbox` can now resolve a providerless definition only when a fresh sandbox is required, wait for its build, and fall back to the provider default when resolution or building fails. `createRepoTemplate()` produces credential-free, commit-pinned definitions for public GitHub repositories.

```ts
const templates = new PlatformTemplateClient();
const build = await templates.build({ environmentId, definition });
const ready = await templates.waitUntilReady({ environmentId, templateId: build.templateId });
const sandbox = new PlatformSandbox({ environmentId, templateId: ready.templateId, templateDefinition: definition });

const repoSandbox = new PlatformSandbox({
  environmentId,
  template: createRepoTemplate({
    repoFullName: 'mastra-ai/mastra',
    setupCommand: 'pnpm install --frozen-lockfile',
  }),
});
await repoSandbox.start();
```

Template environment values are serialized and must not contain secrets.
