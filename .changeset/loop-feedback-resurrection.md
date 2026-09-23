---
'@mastra/core': patch
---

Stop dropping `onIterationComplete` feedback when the hook resurrects a stopped run. When the model had already stopped and the hook returned `{ continue: true, feedback }`, the run continued but the feedback was silently discarded — exactly when the supervisor was course-correcting a stopped model. The feedback is now injected into the transcript before the extra turn runs.
