---
'@mastra/core': minor
---

Added an opt-in `apply_patch` workspace tool that creates, updates, moves and deletes several files in one call. The tool checks the whole patch before it writes anything. If a write fails partway, it tries to undo the changes it already made. The tool is off by default. Enable it per tool:

```ts
new Workspace({
  filesystem: new LocalFilesystem({ basePath: './workspace' }),
  tools: { [WORKSPACE_TOOLS.FILESYSTEM.APPLY_PATCH]: { enabled: true } },
});
```

Setting the top-level `tools.enabled` does not turn it on, so existing agents keep using `write_file` and `edit_file`. Paths follow the same containment, read-before-write and write-lock rules as the other filesystem tools.
