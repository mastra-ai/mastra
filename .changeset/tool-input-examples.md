---
'@mastra/core': minor
---

Add `inputExamples` support on tool definitions to show AI models what valid tool inputs look like.

- Added optional `inputExamples` field to `ToolAction`, `CoreTool`, and `InternalCoreTool` types
- `Tool` class now stores and forwards `inputExamples` from tool config
- `CoreToolBuilder.build()` and `buildProviderTool()` pass `inputExamples` through to the AI SDK, which forwards them to model providers that support it (e.g., Anthropic's `input_examples` beta feature)
