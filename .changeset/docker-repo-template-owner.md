---
'@mastra/docker': patch
---

Added an `owner` option to `createDockerRepoTemplate` and `runWithSecrets` so checkouts work on base images that run as a non-root `USER`. Previously, the checkout was copied as root, so `git` reported "dubious ownership" and writes failed with `EACCES`.

```typescript
createDockerRepoTemplate({
  getRepositoryAccess,
  baseImage: 'node:22',
  owner: 'node',
});
```
