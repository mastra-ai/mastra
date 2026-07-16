---
'@mastra/core': patch
---

Added native structured-output support lookup through the model provider registry.

```ts
import { modelSupportsStructuredOutput } from '@mastra/core/llm';

const supportsStructuredOutput = modelSupportsStructuredOutput('openai/gpt-5.5');
```
