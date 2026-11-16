---
'@mastra/core': patch
---

Fixed tool calls running without their required approval after a resume. When one tool call of a step was suspended or waited for approval and the run was resumed, the next tool call of that step could start without asking for approval. This affected `requireToolApproval` functions passed at call time on `Agent`, and every approval policy on agents created with `createEventedAgent`. Such calls now ask for approval.

On `Agent`, a `requireToolApproval` function is not stored with the run. When a run is resumed without passing it again, every tool call that starts after the resume now asks for approval, including calls the function would not have matched. Pass the same `requireToolApproval` to `resumeStream()` or `approveToolCall()` to keep per-call decisions.
