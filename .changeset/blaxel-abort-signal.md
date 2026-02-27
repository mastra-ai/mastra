---
'@mastra/blaxel': minor
---

feat(blaxel): abort signal support in sandbox commands

- Sandbox commands can now be cancelled via `abortSignal` in command options
- Partial stdout/stderr output is now preserved when a command is aborted or times out
