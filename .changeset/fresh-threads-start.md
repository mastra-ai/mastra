---
'mastracode': minor
'@mastra/code-sdk': minor
'@mastra/core': minor
---

Added `mastracode --new`, which opens the TUI on a new thread instead of resuming the latest thread for the directory. Saved threads are kept, and `/threads` still lists them. `--new` can't be combined with `mastracode resume <thread-id>`, headless runs, `--acp`, or a run without a terminal, and Factory mode ignores it.

`AgentController.createSession()` and `createMastraCode()` take a new `resumeLatestThread` option. Set it to `false` to start a session without binding the most recent thread in its scope:

```ts
const session = await controller.createSession({ createInitialThread: false, resumeLatestThread: false });
```
