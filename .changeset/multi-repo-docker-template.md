---
'@mastra/docker': minor
---

Added a `repos` option to `createDockerRepoTemplate` to build one template from several repositories.

- Each entry has its own `getRepositoryAccess`, `ref` and `setupCommand`, and is cloned to `<workingDirectory>/<repo>`.
- `workspaceSetupCommand` runs once at the working directory after every repository.
- `continueOnSetupFailure` records a failing repository setup in `.mastra-sandbox/setup-failed` instead of failing the build.
- Writes a marker at `.mastra-sandbox/repos/<repo>` after each repository setup and `.mastra-sandbox/workspace-setup` after the workspace step.

```ts
const template = createDockerRepoTemplate({
  repos: [
    { getRepositoryAccess: getApiAccess, setupCommand: 'pnpm install --frozen-lockfile' },
    { getRepositoryAccess: getDocsAccess, ref: 'main', setupCommand: 'npm install' },
  ],
  workspaceSetupCommand: 'touch .workspace-ready',
  continueOnSetupFailure: true,
});
```
