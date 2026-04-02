---
'@mastra/ai-sdk': patch
---

Fixed out-of-memory crash during supervisor/nested agent streaming. The data-tool-agent stream events were growing exponentially due to recursive step nesting and cumulative tool data not being reset between steps. Resolves #14932.
