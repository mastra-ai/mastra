---
'mastracode': patch
---

MastraCode now builds its code agent through the new `createCodingAgent` factory from `@mastra/core/coding-agent` instead of constructing the `Agent` inline. No user-facing behavior changes — the system prompt and agent configuration are unchanged.
