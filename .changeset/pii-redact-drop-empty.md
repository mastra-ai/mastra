---
'@mastra/core': patch
---

Fixed `PIIDetector` sending a message's original text to the model when redaction left nothing usable. With `strategy: 'redact'`, a message is now dropped instead of passed through unredacted when redaction leaves no text or only whitespace (for example an SSN-only message with `redactionMethod: 'remove'`), or when PII is flagged with no usable spans. This applies to `processInput` and `processOutputResult`. Fixes #25553.
