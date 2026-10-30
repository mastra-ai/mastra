---
'@mastra/core': patch
---

Workspace file-modification protection is now off by default and only applies when `requireReadBeforeWrite` is enabled. Previously `write_file`, `edit_file` and `apply_patch` always rejected a file that changed on disk after it was read, with `StaleFileError`, even when `requireReadBeforeWrite` was unset or `false`. Now, with the option unset or `false`, a write succeeds even if the file was changed by another process (`sed -i`, formatters, git) after a read, and `write_file` can overwrite that change. `edit_file` still fails if the text it replaces is gone, and `apply_patch` still rejects a file that changed between its own validation and commit. Set `requireReadBeforeWrite: true` to keep the protection; its behavior is unchanged.

To keep the protection:

```ts
new Workspace({
  filesystem,
  tools: {
    [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: { requireReadBeforeWrite: true },
    [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: { requireReadBeforeWrite: true },
  },
});
```
