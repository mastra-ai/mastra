---
'@mastra/platform-workspace': minor
---

`createRepoTemplate` accepts `buildEnv` (matching `@mastra/e2b`): environment variables available to the template's build steps, such as turbo remote-cache credentials for a `pnpm build` setup command. They are sent as transient build envs and never enter the serialized definition or the template family, so rotating a value does not rebuild the template. Warnings emitted when the template resolver falls back to the provider default now redact credentials.

```ts
createRepoTemplate({
  getRepositoryAccess,
  setupCommand: ['pnpm i', 'pnpm build'],
  buildEnv: { TURBO_TOKEN, TURBO_TEAM, TURBO_CACHE: 'remote:r' },
});
```
