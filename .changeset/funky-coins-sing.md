---
'@mastra/core': minor
---

Added `preserveModelOutput` to `ToolCallFilter` so filtered tool history can keep compact model-facing output without raw tool args or results.

```ts
import { ToolCallFilter } from '@mastra/core/processors';

const filter = new ToolCallFilter({
  preserveModelOutput: true,
});
```
