---
'@mastra/core': patch
---

Fixed AgentController pausing every tool call for approval and running tool calls one at a time. Tools that the session's permission rules already allow now run without an approval round trip. Only tools that need approval (policy `ask`) wait for a decision. Tool calls from the same step, such as several subagents, now run in parallel unless one of them needs approval or can suspend.
