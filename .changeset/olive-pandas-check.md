---
'@mastra/core': minor
---

Exported `validateToolInput` from `@mastra/core/tools` (alongside the existing `validateToolOutput`) for validating a value against a tool's input schema:

```ts
import { validateToolInput } from '@mastra/core/tools';

const { data, error } = validateToolInput(myTool.inputSchema, input, myTool.id);
if (error) {
  // error is a ValidationError describing the schema mismatch
}
```
