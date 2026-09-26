---
'@mastra/core': minor
---

Added `CyberRefusalHandler`, a processor that retries once when an OpenAI or Anthropic cybersecurity safeguard refuses ordinary work partway through an agent run. These refusals are often false positives, and nudging the model to continue usually gets past them. A second refusal on the same step is treated as genuine.

- **OpenAI** refusals (`cyber_policy`, "This content was flagged for possible cybersecurity risk") fail the model call. Register the handler in `errorProcessors`, before `StreamErrorRetryProcessor`.
- **Anthropic** refusals stop the response with a `cyber` classifier refusal (`content-filter` finish reason). Register the handler in `outputProcessors`; the refused step is rolled back before the retry.

```ts
import { Agent } from '@mastra/core/agent';
import { CyberRefusalHandler } from '@mastra/core/processors';

const agent = new Agent({
  id: 'coder',
  name: 'Coder',
  instructions: 'You are a coding agent',
  model: 'openai/gpt-5.6-sol',
  errorProcessors: [new CyberRefusalHandler()],
  outputProcessors: [new CyberRefusalHandler()],
  maxProcessorRetries: 3,
});
```

Coding agents created with `createCodingAgent` include it in both lanes by default, along with a `maxProcessorRetries` budget of 3 — output-step retries have no implicit default, so without a budget the Anthropic retry would be treated as an abort.
