---
'@mastra/mcp': patch
---

Preserve MCP tool failure signals for non-LLM consumers.

With `onToolError: 'return'`, an `isError` tool result now preserves the failure signal without changing the returned shape: it still returns the bare `structuredContent` (so consumers reading fields directly keep working), and the `isError` flag is preserved on a non-enumerable symbol channel alongside the existing `content`/`_meta` channels. Read it with the new `getMcpCallToolIsError()` helper so MCP App UI hosts can detect failure regardless of whether the tool has an output schema. With `onToolError: 'throw'`, the thrown `MastraError` now includes the server's `structuredContent` (JSON-serialized) under `details.structuredContent`, so callers that catch the error can recover structured error data.

This is not a breaking change — the enumerable shape of `structuredContent` is unchanged on both the success and error paths.

```ts
import { getMcpCallToolIsError } from '@mastra/mcp';

const result = await tool.execute(...);
// structured fields remain top-level, exactly as before
if (getMcpCallToolIsError(result)) {
  // non-LLM consumers can now detect an in-band tool failure
}
```
