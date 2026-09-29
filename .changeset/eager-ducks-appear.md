---
'@mastra/core': patch
---

Fixed `Session.sendMessage()` hanging forever when its run never produced a completion event, for example when several turns started at once on the same thread. It now rejects if the session's stream processing fails, and resolves if the run is aborted or the session's thread subscription is torn down. See [#25140](https://github.com/mastra-ai/mastra/issues/25140).
