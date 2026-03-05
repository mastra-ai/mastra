---
'@mastra/core': patch
---

Fixed onIterationComplete feedback being discarded when it returns `{ continue: false }` — feedback is now added to the conversation and the model gets one final turn to produce a text response before the loop stops.
