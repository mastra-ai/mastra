---
'@mastra/code-sdk': patch
'@mastra/factory': patch
---

Factory-owned internal model calls can now recover tenant identity from the trusted controller session when a child request context no longer carries the web-auth user entry. Factory credential priming also hydrates both user-first and org-first snapshots when precedence is not explicitly selected, so signed-in OAuth remains visible to synchronous model routing after a restart without requiring an `OPENAI_API_KEY`. Incomplete or unresolved Factory identity continues to fail closed.
