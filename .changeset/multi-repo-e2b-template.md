---
'@mastra/e2b': minor
---

Added a `repos` option to `createRepoTemplate` to build one template from several repositories.

- Each entry has its own `getRepositoryAccess` and `setupCommand`, and is cloned to `<workingDirectory>/<repo>`.
- `workspaceSetupCommand` runs once at the working directory after every repository.
- `continueOnSetupFailure` records a failing repository setup in `.mastra-sandbox/setup-failed` instead of failing the build.
- Markers: `.mastra-sandbox/repos/<repo>` per repository and `.mastra-sandbox/workspace-setup` for the workspace step.

```ts
const template = createRepoTemplate({
  repos: [
    { getRepositoryAccess: getApiAccess, setupCommand: 'pnpm install --frozen-lockfile' },
    { getRepositoryAccess: getDocsAccess, setupCommand: 'npm install' },
  ],
  workspaceSetupCommand: 'touch .workspace-ready',
  continueOnSetupFailure: true,
});
```
