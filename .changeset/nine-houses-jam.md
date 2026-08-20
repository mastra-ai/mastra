---
'@mastra/core': patch
---

Fixed Anthropic requests failing with a non-retryable 400 error (`This model does not support assistant message prefill`) when a conversation ends with an assistant message and native structured output is used.

The built-in trailing assistant guard, which appends a user message to satisfy this Anthropic constraint, now runs for agents without any configured input processors and for every Anthropic model. Previously it was skipped entirely unless the agent had at least one input processor (or memory/skills), and it only recognized Claude 4.6 model ids — so newer models such as `anthropic/claude-opus-4-7` lost the protection even when it did run. Non-Anthropic models and plain (non-structured-output) Anthropic calls are unaffected.

Fixes [#21913](https://github.com/mastra-ai/mastra/issues/21913).
