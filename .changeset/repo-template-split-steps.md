---
'@mastra/platform-workspace': minor
'@mastra/e2b': minor
---

`createRepoTemplate` now runs each command (clone, fetch, checkout, and each setup command) as its own cached build step, and `setupCommand` accepts an array. A new `workingDirectory` option sets the cwd for the build and for sandboxes created from the template; the repository is cloned to `<workingDirectory>/<repo>`. When omitted, the clone lands in the base image's working directory instead of `$HOME`.

```ts
createRepoTemplate({
  getRepositoryAccess,
  setupCommand: ['pnpm i', 'pnpm build'],
  workingDirectory: '/workspace',
});
```
