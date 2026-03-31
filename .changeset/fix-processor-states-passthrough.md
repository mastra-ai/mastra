---
"@mastra/core": patch
---

Fixed messages not being persisted when multiple memory processors are used together. Processor state is now correctly passed between chained workflow steps, ensuring all messages are saved.
