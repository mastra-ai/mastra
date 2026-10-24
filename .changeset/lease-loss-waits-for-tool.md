---
'@mastra/core': patch
---

Fixed a run that lost its thread lease cutting off the step it was in the middle of: a model response still streaming, or a tool call such as a long command. The run now starts no new step, lets the current one finish, fail or be aborted, keeps what it produced, and then stops. This applies to standard, durable and evented runs. A step still running after `MASTRA_AGENT_THREAD_LEASE_LOST_TOOL_GRACE_MS` (default 5 minutes) is aborted as before. In a deployment with several processes, this means the finishing step can still save its output to the thread for up to that long after another run has taken the thread over.

A lease backend that is slow or doesn't answer no longer stops a run that has a step running, including while it hands the lease back to the run. The run keeps trying to take its lease back and starts no tool until it has it; it stops only when the backend refuses it the lease, which normally means another run holds the thread, or when it is aborted. A durable run can still be stopped by its own execution claim.
