---
'@mastra/platform-workspace': minor
---

Added reusable sandbox templates to Platform workspaces. Build templates through `PlatformSandbox` with the portable `Template()` API, or lazily warm public repositories with `createRepoTemplate()`.

```ts
const sandbox = new PlatformSandbox({
  environmentId,
  template: Template().setWorkdir('/workspace').runCmd('pnpm install'),
});

const repoSandbox = new PlatformSandbox({
  environmentId,
  template: createRepoTemplate({
    repoFullName: 'mastra-ai/mastra',
    setupCommand: 'pnpm install --frozen-lockfile',
  }),
});
```

Template environment values are serialized and must not contain secrets.
