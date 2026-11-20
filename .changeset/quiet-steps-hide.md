---
'@mastra/inngest': patch
---

Fixed Inngest workflows exporting step input and output that the run asked to hide. With `tracingOptions: { hideInput: true, hideOutput: true }`, the step spans and the spans of agents called in a step now hide their input and output, and carry the `requestContextKeys` values, as on the default engine. Fixes [#30868](https://github.com/mastra-ai/mastra/issues/30868).

Fixed `createInngestAgent` traces where the thread title model call showed as a separate top-level span. It now sits under the agent run, hides the same input and output, and follows the run's sampling decision.
