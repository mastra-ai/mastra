---
'@mastra/core': patch
---

Added a `getBasePath` option to `AgentsMDInjector`. When set, relative tool paths resolve against that directory instead of `process.cwd()`, and `AGENTS.md`/`CLAUDE.md` files outside it are never injected.

```ts
new AgentsMDInjector({
  getBasePath: () => '/path/to/checkout',
});
```
