---
'@mastra/core': patch
---

Fixed evented workflow runs storing the wrong `result`. A finished evented run now stores the workflow's output, like the default engine, instead of the last step's internal record (`{ status, payload, output, startedAt, endedAt }`). Suspended and canceled evented runs no longer store a result. `getWorkflowRunById()`, Studio's run view, the run endpoints and `client-js` now return the same `result` as `run.start()`. Runs stored before this fix keep their old shape. Fixes [#29759](https://github.com/mastra-ai/mastra/issues/29759).
