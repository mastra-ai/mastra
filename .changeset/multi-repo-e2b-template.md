---
'@mastra/e2b': minor
---

Add a `repos` form to `createRepoTemplate` that clones several repositories into one E2B template. Each entry has its own `getRepositoryAccess` and `setupCommand`; `workspaceSetupCommand` runs at the working directory after every repository and `continueOnSetupFailure` records failing per-repository setups in `.mastra-sandbox/setup-failed` instead of failing the build. Each repository writes `.mastra-sandbox/repos/<repo>`, public repositories build before private ones, and the tag hashes every pinned sha.

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
