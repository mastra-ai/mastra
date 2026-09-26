---
'@mastra/code-sdk': patch
---

Mastra Code now retries once when OpenAI or Anthropic cybersecurity safeguards refuse ordinary coding work partway through a run, instead of stopping the run with a refusal error.

The behavior needs no configuration:

```ts
import { mountAgentControllerOnMastra } from '@mastra/code-sdk';

const { mastra, controller } = await mountAgentControllerOnMastra({ cwd: process.cwd() });
```
