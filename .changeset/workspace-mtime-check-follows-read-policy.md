---
'@mastra/core': patch
---

Workspace file-modification protection is now off by default and only applies when `requireReadBeforeWrite` is enabled. Previously `write_file`, `edit_file` and `apply_patch` always rejected a file that changed on disk after it was read, with `StaleFileError`, even when `requireReadBeforeWrite` was unset or `false`. Now, with the option unset or `false`, a write succeeds even if the file was changed by another process (`sed -i`, formatters, git) after a read, and can overwrite that change. Set `requireReadBeforeWrite: true` to keep the protection; its behavior is unchanged.
