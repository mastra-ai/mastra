---
"@mastra/core": patch
---

`AgentChannels` now awaits the agent run to completion when an incoming chat message wakes a new run.

Previously the webhook handler fired `agent.sendMessage(...)` and returned immediately, relying on a side-effect subscription to drive the agent stream. That works in long-lived Node processes but breaks in serverless runtimes (Vercel, AWS Lambda, etc.) where the function exits as soon as it returns and kills the run mid-flight, producing missing or partial responses.

When `sendMessage` returns an `ownerStream` (i.e. the call woke a new run from idle), the handler now awaits `ownerStream.consumeStream()` before returning, keeping the host alive for the duration of the run. Calls that join an in-flight run, queue, persist, or discard are unaffected.
