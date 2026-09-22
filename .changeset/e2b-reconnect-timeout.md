---
'@mastra/e2b': patch
---

Honor the configured `timeout` when reconnecting to or resuming an existing E2B sandbox. Previously `timeout` was only applied on sandbox creation; the reconnect and resume paths called `Sandbox.connect` without `timeoutMs`, so the e2b SDK fell back to its 5-minute default. With the default `lifecycle.onTimeout: 'pause'`, this meant a paused sandbox always came back with a 5-minute window regardless of the configured `timeout`. Both `Sandbox.connect` paths now forward `timeoutMs`, so a resumed sandbox gets at least the configured window.
