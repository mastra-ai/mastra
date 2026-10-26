---
'@mastra/core': patch
---

Added span attribution to system messages in model inference traces. Each system message in a `MODEL_INFERENCE` span input now carries the `spanId` of the span that added it: agent instructions point to the agent run span, and messages added or returned by a processor point to that processor's span. This works across steps, parallel processor branches, and durable and evented agents. The leading system message keeps its `spanId` when background-task guidance or the auto-resume directive is appended to it. Messages rewritten by `processLLMRequest` have no `spanId`. The id is only recorded in traces: it is never sent to the model provider and does not affect response cache keys.
