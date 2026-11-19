---
'@mastra/core': patch
---

`DurableAgent.observe()` now accepts `closeOnSuspend`, so an observer's stream can end when the observed run suspends (for example while waiting for tool approval). Previously the observed stream stayed open at the suspension boundary — a reconnecting client or another replica would hang — because `observe()` never forwarded the option to the underlying durable stream. Passing `closeOnSuspend: true` resolves `fullStream`/`text`/`getFullOutput()` at the suspension boundary, matching `stream()`.

The default (`false`) keeps the stream open across suspension so a later resume can continue on the same reader, and closing stays observer-scoped, preserving the run's registry entry and replay history for `resume()`/`resumeStream()`. A replayed suspension the run has already been resumed past is still delivered and fires `onSuspended`, but doesn't end the stream, so replaying a run from its start doesn't stop at an approval that was given long ago.
