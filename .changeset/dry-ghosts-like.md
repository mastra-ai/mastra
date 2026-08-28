---
'@mastra/platform-workspace': minor
---

Added reusable sandbox templates to Platform workspaces. Build templates through `PlatformSandbox` with the portable `Template()` API; Platform content-addresses each serialized definition for reuse. Public repositories can be warmed lazily with `createRepoTemplate()`. Use `cpuCount()` and `memoryMB()` to size E2B template builds and sandboxes created from the exact or a resource-matched stale build; `createRepoTemplate()` accepts the same sizing as plain options. Railway ignores these resource methods.

```ts
const sandbox = new PlatformSandbox({
  environmentId,
  template: Template().cpuCount(4).memoryMB(8192).runCmd('pnpm install'),
});

// createRepoTemplate takes the whole sandbox context: a session with no
// repository gets undefined back and boots the provider default.
const repoSandbox = new PlatformSandbox({
  environmentId,
  template: createRepoTemplate({
    getRepositoryAccess: async () => ({ cloneUrl: 'https://github.com/mastra-ai/mastra.git' }),
    setupCommand: 'pnpm install --frozen-lockfile',
    memoryMB: 2048,
  }),
});
```

Template environment values are serialized by default. Pass `{ ephemeral: true }` to `setEnvs()` for short-lived build credentials that must stay outside the definition, identity, persistent record, and runtime environment. `Template.build()` can eagerly start or reuse the provider build without provisioning a sandbox. Railway includes transient values in its provider cache input, so rotating one may trigger another Railway build while the Platform template ID remains stable.

`PlatformSandbox.start()` never blocks on a template build. When the exact template is not yet ready, Platform boots the sandbox on the best available fallback (an E2B prior member of the same family with matching effective resources if one exists, otherwise the provider base template) and builds the exact template in the background. A provider-base fallback may use provider-default resources. The sandbox surfaces `templatePending` for observability; reconcile filesystem state in your own runtime setup (for example, an `onStart` hook that runs `git fetch && git checkout <sha>`).

`Template().withFamily(key)` attaches a caller-supplied family key that groups successive builds of the "same thing" (e.g. the same repository+workdir across commits) so an E2B definition can warm-start on a resource-matched prior member of the same family. Railway doesn't use family fallback. `createRepoTemplate()` populates the key automatically as `repo:<cloneUrl>:<workdir>`.
