---
'@mastra/core': patch
---

Fixed a suspending tool call dropping the other tool calls in its step (#26514). When several tool calls shared a step and one suspended (approval, `suspend()`, or a sub-agent asking a question), siblings that had already finished lost their results, and siblings queued after the suspending call never ran. Now, for both `Agent` and durable agents:

- Other tool calls in the step still run, and their results (including errors) are saved to memory before the step suspends, so the next turn — including `autoResumeSuspendedTools` — sees them.
- Tool calls that need approval or can suspend still wait for the resume, so approvals are still asked one at a time.
