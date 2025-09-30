---
'@mastra/core': patch
---

When an error would happen in a function like onStepResult, there are other code that executes synchronously and will execute after the controller already closes. We need to make sure we're only trying to enqueue chunks when the controller is still open.
