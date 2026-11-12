---
'@mastra/code-sdk': patch
'@mastra/factory': patch
---

Mastra Code's Knowledge scopes now use canonical addresses, matching `@mastra/core`'s one-segment scope values. Factory sessions hold their org and project ids encoded (`org:acme%3Aeu` for org `acme:eu`), and the `/knowledge` inspector and Factory Knowledge routes read the same addresses the code agent writes, instead of encoding host scopes a second time.
