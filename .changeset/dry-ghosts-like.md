---
'@mastra/platform-workspace': minor
---

Added reusable sandbox templates to Platform workspaces. Build and poll templates with `PlatformTemplateClient`, create sandboxes from tenant-bound handles, or lazily warm public repositories with `createRepoTemplate()`.

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
