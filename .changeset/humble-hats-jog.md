---
'@mastra/core': patch
---

Added an option to limit language servers retained by a workspace. Workspaces remain unlimited when the option is omitted.

```ts
const workspace = new Workspace({
  lsp: { maxOpenClients: 4 },
});
```

When using `workspace.lsp.prepareQuery()`, call `release()` on the returned query after closing the file.
