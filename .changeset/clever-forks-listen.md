---
"@mastra/core": patch
---

Add `onOutput` hook for tools

Tools now support an `onOutput` lifecycle hook that is invoked after successful tool execution. This complements the existing `onInputStart`, `onInputDelta`, and `onInputAvailable` hooks to provide complete visibility into the tool execution lifecycle.

The `onOutput` hook receives:
- `output`: The tool's return value (typed according to `outputSchema`)
- `toolCallId`: Unique identifier for the tool call
- `toolName`: The name of the tool that was executed
- `abortSignal`: Signal for detecting if the operation should be cancelled

Example usage:

```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const weatherTool = createTool({
  id: "weather-tool",
  description: "Get weather information",
  outputSchema: z.object({
    temperature: z.number(),
    conditions: z.string(),
  }),
  execute: async (input) => {
    return { temperature: 72, conditions: "sunny" };
  },
  onOutput: ({ output, toolCallId, toolName }) => {
    console.log(`${toolName} completed:`, output);
    // output is fully typed based on outputSchema
  },
});
```

Hook execution order:
1. `onInputStart` - Input streaming begins
2. `onInputDelta` - Input chunks arrive (called multiple times)
3. `onInputAvailable` - Complete input parsed and validated
4. Tool's `execute` function runs
5. `onOutput` - Tool completed successfully (NEW)
