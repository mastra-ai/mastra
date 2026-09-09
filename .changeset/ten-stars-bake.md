---
'@mastra/core': patch
---

Fixed OpenCode Go requests failing because the required x-opencode-session header was not sent. Mastra now includes a stable session ID on OpenCode and OpenCode Go model requests so routing and prompt caching work.
