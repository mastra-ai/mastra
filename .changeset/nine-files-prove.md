---
'@mastra/core': minor
---

Added PIIRedactor, a deterministic processor that detects and redacts pattern-shaped PII (emails, phone numbers, credit cards, SSNs, API keys, and more) using regex only. It never calls an LLM, so message content never leaves the process through this processor. Use it when compliance rules forbid sending content to a model provider, or when you need deterministic, auditable redaction.

```ts
import { PIIRedactor } from '@mastra/core/processors';

const redactor = new PIIRedactor({
  detectionTypes: ['email', 'phone', 'credit-card'],
  strategy: 'redact',
  redactionMethod: 'mask',
});
```

For context-dependent PII (names, addresses, dates of birth), keep using the LLM-based PIIDetector.
