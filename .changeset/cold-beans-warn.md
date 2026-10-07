---
'@mastra/code-sdk': minor
---

Added `runThinkingLevel` to `@mastra/code-sdk/thinking`. It returns the thinking level a request actually sends for a model, using the reasoning options models.dev publishes. `getAvailableThinkingLevelsForModel` takes the same options and lists only levels that send a different request.

```ts
import { getModelReasoningOptions } from '@mastra/core/llm';
import { getAvailableThinkingLevelsForModel, runThinkingLevel } from '@mastra/code-sdk/thinking';

const options = getModelReasoningOptions('openai/gpt-5');
runThinkingLevel('openai/gpt-5', 'max', options); // 'high'
getAvailableThinkingLevelsForModel('openai/gpt-5', options); // ['off', 'low', 'medium', 'high']
```

Fixed GPT-5 requests at Extra high or Max thinking. They sent `xhigh`, an effort models.dev does not list for the model, and now send `high`.
