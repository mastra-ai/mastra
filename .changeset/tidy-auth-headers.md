---
'@mastra/core': patch
---

Fixed gateway authentication so empty header objects fall back to API keys and are not reported as valid credentials.
