---
'@mastra/code-sdk': patch
---

Added Extra high thinking to xAI models that list it, such as Grok 4.6.

```ts
import { getModelReasoningOptions } from '@mastra/core/llm';
import { getAvailableThinkingLevelsForModel } from '@mastra/code-sdk/thinking';

getAvailableThinkingLevelsForModel('xai/grok-4.6', getModelReasoningOptions('xai/grok-4.6'));
// ['off', 'low', 'medium', 'high', 'xhigh']
```
