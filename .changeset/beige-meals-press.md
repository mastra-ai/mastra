---
'@mastra/core': patch
---

Fixed tool calls running without their required approval after a resume. When the model called several tools in one response and one of them suspended or waited for approval, a later tool call from that response could run after the resume without asking. This affected `requireToolApproval` functions passed at call time on `Agent`, and every approval policy on agents created with `createEventedAgent`. Such calls now ask for approval. Agents created with `createEventedAgent` also no longer ask for approval of a call that a `requireToolApproval` function does not match.

On `Agent`, a `requireToolApproval` function is not stored with the run. When a run is resumed without passing it again, every tool call that starts after the resume now asks for approval, including calls the function would not have matched. Pass the same `requireToolApproval` to `resumeStream()` or `approveToolCall()` to keep per-call decisions.

A tool that called `suspend()` on a version older than 1.50.0 and is resumed after the upgrade still receives its resume data, but no longer receives the payload it suspended with.
