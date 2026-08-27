---
'@mastra/e2b': minor
---

Repo templates accept machine resources: pass `cpuCount` and `memoryMB` to `createRepoTemplate` and the built template's sandboxes get exactly that machine size.

**Resources are part of the template's identity.** They are hashed into the template name alongside the repository, setup command, and build env, so a resize builds a new template instead of silently reusing one built at the old size. Absent options normalize to the SDK defaults (2 vCPU, 1024 MB).

**Fallbacks keep the size.** When a repo template's build fails and the sandbox degrades to the default mountable template, the default is built at the requested size too — a 2 GB session's setup never lands in a 1 GB fallback and runs out of memory.

```ts
new E2BSandbox({
  id: sessionId,
  template: createRepoTemplate({ ...ctx, memoryMB: 2048, cpuCount: 4 }),
});
```
