---
'@mastra/braintrust': patch
'@mastra/langsmith': patch
'@mastra/sentry': patch
---

Fixed spans that stayed open when `spanFilter` dropped only their end. The span now closes at its end time, with no error.
