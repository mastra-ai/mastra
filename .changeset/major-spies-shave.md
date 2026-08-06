---
'@mastra/ai-sdk': minor
---

Fixed nested agent streams to emit compact snapshots until each step completes, and added `data-tool-agent-step` as a new stream part type (exported as `AgentStepDataPart`) that carries the full completed-step detail for consumers that observe suspension without a finish event.
