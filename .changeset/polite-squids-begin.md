---
'@mastra/core': patch
---

Fixed claimed-owner discovery retries starting before their backoff window ends when a timer wakes early. Preserve the full discovery deadline and allow owners to respond during the final attempt.
