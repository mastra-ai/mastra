---
'@mastra/code-sdk': patch
---

Factory-owned internal model calls can now recover the tenant credential scope from the trusted controller session when a child request context no longer carries the web-auth user entry. This keeps OpenAI Codex OAuth available to observational-memory observer and reflector runs without requiring an `OPENAI_API_KEY`, while incomplete or unresolved Factory identity continues to fail closed.
