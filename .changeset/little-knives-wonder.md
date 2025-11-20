---
"@mastra/core": patch
---

Don't call `os.homedir()` at top level (but lazy invoke it) to accommodate sandboxed environments
