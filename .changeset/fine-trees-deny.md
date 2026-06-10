---
'@mastra/core': patch
---

Fixed DurableAgent ending a run when every tool call in a step errored. The durable agentic loop stopped as soon as a step's tool calls all failed, so a single throwing tool (a bad argument, an upstream 500, a timeout) cut the turn off mid-work and the error result never reached the model. This diverged from the regular Agent.stream() loop, which feeds tool errors back so the model can retry and self-correct. The durable loop now keeps the LLM step's own continue decision and lets the error results flow back to the model, while maxSteps still bounds a tool that keeps failing.
