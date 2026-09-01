---
'@mastra/platform-workspace': minor
'@mastra/e2b': minor
---

**Repo templates: one build step per command, and a `workingDirectory` option**

`createRepoTemplate` now emits one build step per command (clone, fetch, checkout, and each setup command) instead of one combined step, so a failed template build reports the exact command that failed and completed steps stay layer-cached across attempts. `setupCommand` also accepts an array to run each entry as its own step, e.g. `['pnpm i', 'pnpm build']`. Blank setup entries are dropped instead of failing the build.

`createRepoTemplate` also accepts a `workingDirectory` option: an absolute directory created at the start of the build and set as the cwd for every later step and for sandboxes created from the template. The repository is cloned relative to that cwd, so it lands at `<workingDirectory>/<repo>` and sandboxes start where the repo lives. It participates in template identity. When omitted, the build and the runtime use the base image's working directory, and the clone lands at `<image cwd>/<repo>`. Previously the clone was hardcoded to `$HOME/<repo>` while the runtime cwd came from the image, which diverged on images that set a `WORKDIR` (such as the platform base's `/workspace`) and caused a second cold clone at session start.

`@mastra/platform-workspace`'s `createRepoTemplate` also accepts `buildEnv` (matching `@mastra/e2b`): environment variables available to the build steps, such as turbo remote-cache credentials for a `pnpm build` setup command. They are sent as transient build envs and never enter the serialized definition or the template family, so rotating a value does not rebuild the template.

```ts
createRepoTemplate({
  getRepositoryAccess,
  setupCommand: ['pnpm i', 'pnpm build'],
  workingDirectory: '/workspace',
  buildEnv: { TURBO_TOKEN, TURBO_TEAM, TURBO_CACHE: 'remote:r' },
});
```
