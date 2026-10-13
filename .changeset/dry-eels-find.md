---
'@mastra/core': patch
---

Fixed a suspending tool call dropping the other tool calls in its step: when several tool calls shared a step and one suspended (HITL, approval, or a sub-agent asking a question), the sibling calls that had already finished lost their results — no tool-result reached the stream's history, memory persisted them as bare calls, and later turns (including autoResumeSuspendedTools) never saw their work. Finished sibling results are now committed and persisted when the step suspends. Fixes #26514
