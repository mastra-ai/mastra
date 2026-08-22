---
'@mastra/platform-workspace': minor
---

Added reusable sandbox templates to Platform workspaces. Build templates through `PlatformSandbox` with the portable `Template()` API, which derives a deterministic identity for reuse, or lazily warm public repositories with `createRepoTemplate()`.

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

Repository templates carry deterministic family and commit lineage for provider-native reuse. Set `staleWhileRevalidate: true` only when runtime setup reconciles the checkout after boot; otherwise repository templates wait for the exact commit. Template environment values are serialized and must not contain secrets.
