---
'@mastra/platform-workspace': minor
---

Added reusable sandbox templates to Platform workspaces. Build templates through `PlatformSandbox` with the portable `Template()` API; Platform content-addresses each serialized definition for reuse. Public repositories can be warmed lazily with `createRepoTemplate()`.

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

`PlatformSandbox.start()` never blocks on a template build. When the exact template is not yet ready, Platform boots the sandbox on the best available fallback (a prior member of the same family if one exists, otherwise the provider base template) and builds the exact template in the background. The sandbox surfaces `templatePending` for observability; reconcile filesystem state in your own runtime setup (for example, an `onStart` hook that runs `git fetch && git checkout <sha>`).

`Template().withFamily(key)` attaches a caller-supplied family key that groups successive builds of the "same thing" (e.g. the same repository+workdir across commits) so a new definition can warm-start on a prior member of the same family. `createRepoTemplate()` populates it automatically as `repo:<repoFullName>:<workdir>`.
