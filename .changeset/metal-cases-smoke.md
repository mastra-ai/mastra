---
'@mastra/core': minor
---

Added `getModelReasoningOptions` to read which reasoning controls a model accepts, as published by models.dev: named effort levels, a thinking-token budget, or an on/off toggle. Returns `undefined` when no data describes the model.

```ts
import { getModelReasoningOptions } from '@mastra/core/llm';

getModelReasoningOptions('anthropic/claude-sonnet-4-6');
// [{ type: 'effort', values: ['low', 'medium', 'high', 'max'] }, { type: 'budget_tokens', min: 1024 }]

getModelReasoningOptions('anthropic/claude-haiku-4-5');
// [{ type: 'budget_tokens', min: 1024 }]
```

Use it to offer only the reasoning levels a model supports instead of hard-coding them per model.
