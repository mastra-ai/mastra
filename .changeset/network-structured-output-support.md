---
'@mastra/core': minor
'@mastra/ai-sdk': minor
---

Add structured output support for agent network executions

Introduces a centralized accumulator-based approach to collect streaming network events and produce a single, type-safe structured result. This feature simplifies consuming network results by eliminating the need to manually parse and correlate multiple event types, while preserving existing streaming behavior.

Key additions:
- `NetworkOutputAccumulator` class for collecting and processing network events
- Structured output configuration via `structuredOutput` option in network execution
- Type-safe result extraction with Zod schema support
- Maintains full backward compatibility with existing streaming APIs

Related to #11337
