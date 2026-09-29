---
'@mastra/core': patch
---

The evented workflow engine now honors `emitStepEvents: false` (step-lifecycle watch events are suppressed instead of the option being silently ignored) and fails loudly when `createRun()` is called on an evented workflow that has no registered Mastra host, instead of starting a run that hangs or fails deep inside the event processor. Run-level events and execution routing are unaffected by the step-event gate.
