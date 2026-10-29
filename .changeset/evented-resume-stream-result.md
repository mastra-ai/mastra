---
'@mastra/core': patch
---

Fixed `resumeStream()` on evented workflows rejecting its `result` with "promise 'result' was not resolved or rejected when stream finished". The stream now stays open until the resumed run's result is set.
