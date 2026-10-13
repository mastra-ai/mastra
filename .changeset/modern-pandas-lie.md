---
'@mastra/core': patch
'@mastra/server': patch
---

Fixed evented agents and nested evented workflows failing with `Workflow with id ... not found` when an orchestration worker runs steps on the API server through `MASTRA_STEP_EXECUTION_URL`. The worker now sends the parent workflow with each step request, so the server can find steps that are only reachable through their parent workflow, such as the steps of an evented agent. Fixes [#26676](https://github.com/mastra-ai/mastra/issues/26676).

Also fixed nested evented workflows hanging when their parent workflow is registered under a key that differs from its `id`.
