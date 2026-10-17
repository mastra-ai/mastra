---
'@mastra/core': patch
---

Fixed resumed runs (for example after `approveToolCall`) dropping system messages that input processors add in `processInput`. This includes the task-list instruction from `TaskSignalProvider`.

On resume, input processors now run again on a list that holds only system messages. If a processor returns the same system messages on every call, the resumed model call sends the same system messages as the original run. Provider prompt caches then stay valid across approvals.

Some system messages are not reproduced exactly:

- Messages a processor builds from user or conversation messages are not reproduced, because no conversation messages are available during the replay.
- Messages that depend on changing state, such as a clock or counter, may differ.

Behavior change: each input processor's `processInput` now runs once more on every resume. Make sure its side effects (logging, counters, storage writes, LLM calls) are safe to repeat.
