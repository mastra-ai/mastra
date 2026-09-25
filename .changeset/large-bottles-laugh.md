---
'@mastra/memory': patch
---

Fixed Observational Memory sending an oversized prompt when a large tool result pushed a step over the `messageTokens` threshold. Activating buffered observations could leave the newest messages unobserved and still above the threshold, and the next model call could exceed the model's context window (for example, failing with "prompt is too long"). Observational Memory now activates every buffered observation it needs, then observes any remaining messages synchronously when the context is still above the threshold. Fixes [#19767](https://github.com/mastra-ai/mastra/issues/19767).
