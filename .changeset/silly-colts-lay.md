---
'@mastra/core': patch
---

Fixed evented workflows running a step again when its event arrives after the step finished, such as a broker redelivery or a message that waited in a queue while `restart()` ran the step (#28712). The worker now continues the run from the step's saved result, or drops the event when the run already moved past the step. A run whose worker stopped after saving a step's result, before the next step started, continues the same way when the step's event is delivered again. When such a late event has used up its delivery attempts, it's dropped and no longer fails the run. Workflows with `autoRestartActiveRuns: false` behave as before.
