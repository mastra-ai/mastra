---
'@mastra/core': patch
---

Fixed workspace `write_file`, `edit_file` and `apply_patch` rejecting a file that changed on disk after it was read when `requireReadBeforeWrite` is unset or `false`. The modified-time check now only applies when `requireReadBeforeWrite` is enabled, so shell edits (`sed -i`, formatters, git) between a read and a write no longer fail with `StaleFileError`. Behavior with `requireReadBeforeWrite: true` is unchanged.
