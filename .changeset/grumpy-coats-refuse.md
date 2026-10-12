---
'@mastra/core': patch
---

Fixed AgentController to honor savePerStep, keep stopWhen and processor tool results scoped to each step after saving or resuming, and retry messages after failed memory writes. Fixes https://github.com/mastra-ai/mastra/issues/25538.
