---
'@mastra/core': patch
---

Fixed a step running a nested workflow that fails dropping the state the workflow's completed steps had set, on the default engine. When a nested run fails after an earlier step called `setState`, that state is now handed back to the parent run, so a failed run reports it with `outputOptions: { includeState: true }` — the same as an equivalent flat workflow and the evented engine already did. Fixes [#29733](https://github.com/mastra-ai/mastra/issues/29733).
