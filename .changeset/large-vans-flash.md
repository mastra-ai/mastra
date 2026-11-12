---
'@mastra/core': patch
---

Fixed a type error when calling a tool directly without a context. `tool.execute(input)` now compiles, so you no longer need casts like `tool.execute(input, {} as ToolExecutionContext)` in tests, scripts, or other tools. Without a context the tool still gets an empty request context but no Mastra instance, writer, memory, or thread IDs, so pass a context when the tool needs those. Fixes #28651.

If your code assigns its own function to `tool.execute`, declare that function's context parameter as optional (`context?`). Helpers that infer from the function type, such as `vi.fn(tool.execute!)`, still see the signature that requires a context, as before.
