---
'@mastra/platform-workspace': minor
'@mastra/e2b': minor
---

**Repo templates: one build step per command, and a `workingDirectory` option**

`createRepoTemplate` now emits one build step per command (clone, fetch, checkout, and each setup command) instead of one combined step, so a failed template build reports the exact command that failed and completed steps stay layer-cached across attempts. `setupCommand` also accepts an array to run each entry as its own step, e.g. `['pnpm i', 'pnpm build']`. Blank setup entries are dropped instead of failing the build.

`createRepoTemplate` also accepts a `workingDirectory` option: an absolute directory the repository is cloned into (`<workingDirectory>/<repo>`), baked into the template as the runtime default cwd, so sandboxes created from the template start where the repo lives. It participates in template identity; omitted keeps the previous layout (`$HOME/<repo>`, no baked workdir).

`@mastra/platform-workspace`'s `createRepoTemplate` also accepts `buildEnv` (matching `@mastra/e2b`): environment variables available to the build steps, such as turbo remote-cache credentials for a `pnpm build` setup command. They are sent as transient build envs and never enter the serialized definition or the template family, so rotating a value does not rebuild the template.

```ts
createRepoTemplate({
  getRepositoryAccess,
  setupCommand: ['pnpm i', 'pnpm build'],
  workingDirectory: '/workspace',
  buildEnv: { TURBO_TOKEN, TURBO_TEAM, TURBO_CACHE: 'remote:r' },
});
```
