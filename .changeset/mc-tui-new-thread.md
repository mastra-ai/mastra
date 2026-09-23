---
'mastracode': minor
---

**Added `--tui-new-thread` to start Mastra Code on a new conversation** instead of resuming the directory's most recent one, like running `/new` first. Combine it with a startup prompt to open a fresh session on a task:

```sh
mastracode --tui-new-thread --tui-initial-prompt "Draft release notes for this branch"
```
