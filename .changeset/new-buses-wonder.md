---
'@mastra/temporal': minor
---

Added Temporal-backed workflow suspend and resume support. `run.start()` and `run.resume()` now return Mastra-compatible suspended results while the Temporal workflow remains open waiting for a signal, and resumed step results include their suspend payload and resume data. Successful Temporal runs now return the workflow result directly in the standard Mastra result shape and expose normalized `StepResult` entries in `steps`.

Resume a suspended step and wait for its next suspended or terminal result with `run.resume({ step: 'approval', resumeData })`. Use `run.resumeAsync({ step: 'approval', resumeData })` to signal the workflow without waiting. Keyless resumes target the only active suspension, and resume labels declared by `suspend(payload, { resumeLabel })` are also supported.
