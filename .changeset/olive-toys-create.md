---
'@mastra/core': patch
---

Fixed `sendSignal(...).accepted` on a `DurableAgent`: an idle wake now resolves `output` to the run's model output, so `await accepted.output.text` returns the answer instead of `undefined`. Fixes #25163.
