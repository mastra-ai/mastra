---
'@mastra/core': patch
---

Fixed five DurableAgent behavioral parity gaps with the regular Agent loop:

- **Goal step**: Durable agents now honor goal-aware stop semantics. The `goalStep` has been ported into the durable workflow, reading goal config, running completion scorers, and emitting goal chunks — matching the regular agent's behavior.

- **Output processors for tool chunks**: Tool-result and tool-error chunks on durable agents now pass through output processors before emission, enabling content moderation and redaction workflows.

- **Cached response replay**: Input processors that return a cached response via `processLLMRequest` now work on durable agents, short-circuiting the model call and replaying cached chunks.

- **toModelOutput normalization**: Durable agents now call `toModelOutput` on successful tool results under a MAPPING observability span and normalize the output to AI SDK format, matching the regular agent's behavior.

- **Client-tool observability**: `onInputStart` and `onInputDelta` callbacks on tool definitions are now invoked during durable agent streaming, and client-tool observability spans are created for tool input streaming.
