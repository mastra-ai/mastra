---
'@mastra/core': patch
'@mastra/inngest': patch
---

Type the engine context handed to Inngest workflow steps. `engine.step` inside `createStep({ execute })` is now Inngest's own step tooling instead of `any`, so `step.run`, `step.sendEvent`, `step.waitForEvent` and `step.sleep` are checked at compile time. `StepParams` in core gained a trailing `TEngineType` generic (defaulting to the built-in engine) so engine adapters can narrow the context without core knowing about any specific engine.
