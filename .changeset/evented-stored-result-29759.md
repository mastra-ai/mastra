---
'@mastra/core': patch
---

Fixed evented workflow runs storing the wrong `result`. A finished run now stores the workflow output, as the default engine does.

**What changed**

- `getWorkflowRunById()`, Studio's run view, the run endpoints, and `client-js` now return the same `result` as `run.start()`.
- Suspended and canceled evented runs no longer store a `result`.
- Runs stored before this fix keep their old `result` shape.

Fixes [#29759](https://github.com/mastra-ai/mastra/issues/29759).
