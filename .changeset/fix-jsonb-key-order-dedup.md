---
"@mastra/core": patch
---

Fixes a crash where OpenAI rejects resumed tool-approval requests with `AI_APICallError: Duplicate item found with id rs_*`.

The same message stored in PostgreSQL's `jsonb` column (workflow snapshot) and `text` column (messages) could have different JSON key orders, causing the deduplication check to treat them as different messages and send the same reasoning item twice. Both representations now compare equal regardless of key order.
