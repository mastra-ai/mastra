---
'@mastra/platform-workspace': minor
---

Added a `repos` option to `createRepoTemplate` to build one template from several repositories.

- Each entry has its own `getRepositoryAccess` and `setupCommand`, and is cloned to `<workingDirectory>/<repo>`.
- `workspaceSetupCommand` runs once at the working directory after every repository.
- `continueOnSetupFailure` records a failing repository setup in `.mastra-sandbox/setup-failed` instead of failing the build.
- Writes a marker at `.mastra-sandbox/repos/<repo>` after each repository setup and `.mastra-sandbox/workspace-setup` after the workspace step.

```ts
const template = createRepoTemplate({
  repos: [
    {
      getRepositoryAccess: async () => ({ cloneUrl: 'https://github.com/acme/app.git' }),
      setupCommand: 'pnpm install --frozen-lockfile',
    },
    {
      getRepositoryAccess: async () => ({
        cloneUrl: 'https://github.com/acme/shared-ui.git',
        authorization: { scheme: 'bearer', token: process.env.GITHUB_TOKEN! },
      }),
      setupCommand: 'pnpm install --frozen-lockfile',
    },
  ],
  workspaceSetupCommand: 'cd app && pnpm link ../shared-ui',
  workingDirectory: '/home/user/repos',
});
```
