---
'@mastra/core': patch
---

Fixed prompt caching breaking after a suspended or tool-approval run resumes from Postgres storage. Postgres `jsonb` reorders object keys, so a restored run sent tool-call arguments and JSON tool results with their keys in a different order than the original run. The prompt bytes changed, and providers such as OpenAI missed their prompt cache from the first tool call onward. Tool-call arguments and JSON tool results in model prompts now have their object keys sorted, so the same content always produces the same request. Stored messages are not changed.
