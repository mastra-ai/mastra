---
'@mastra/core': patch
---

Fix onIterationComplete feedback silently discarded when continue: false

When `onIterationComplete` returned `{ continue: false, feedback: "..." }`, the feedback message was never added to the conversation because `hasFinishedSteps` was set to `true` before the feedback condition was evaluated.

Now, when `continue: false` is returned with feedback, the feedback is added to the conversation and the model gets one final turn to produce a text response before the loop stops.
