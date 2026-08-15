---
'@mastra/core': patch
---

Don't attempt a sub-agent resume when there is no suspended run to resume.

The delegation step selected the resume path on `resumeData` alone and called `resumeStream`/`resumeGenerate` with `runId: suspendedToolRunId`, which is `undefined` when the suspended-run lookup finds nothing. That produced an unsatisfiable snapshot lookup and threw `AGENT_RESUME_NO_SNAPSHOT_FOUND` before the sub-agent ran.

`resumeData` is an optional field on the generated sub-agent tool schema, so a model can populate it at any time — including on a first delegation, where nothing is suspended and the auto-resume system-message suffix was never injected. Both resume call sites now also require a non-empty `suspendedToolRunId`, falling through to a normal fresh run otherwise.
