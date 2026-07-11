---
'@mastra/core': patch
'@mastra/pg': patch
'@mastra/server': patch
'@mastra/client-js': patch
---

Added stable metrics and logs capability reporting for observability storage. Studio now uses the capability response instead of relying on constructor names, with a fallback for older servers.
