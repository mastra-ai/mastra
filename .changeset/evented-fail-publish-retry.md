---
'@mastra/core': patch
---

Fixed evented workflows and evented agents hanging when a step exhausts its retries and publishing the `workflow.fail` event briefly fails. Previously the failure was logged and dropped, so `run.start()`, `agent.generate()` and `agent.stream()` never resolved and the run stayed `running`. The failure is now retried on redelivery (up to 3 publish attempts) so callers receive the error and the run is stored as `failed`.
