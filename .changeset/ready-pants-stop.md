---
'@mastra/core': patch
---

Fixed agentic loop continuing indefinitely when model hits max output tokens (finishReason: 'length'). Previously, only 'stop' and 'error' were treated as termination conditions, causing runaway token generation up to maxSteps when using structuredOutput with generate(). The loop now correctly stops on 'length' finish reason. Fixes #13012.
