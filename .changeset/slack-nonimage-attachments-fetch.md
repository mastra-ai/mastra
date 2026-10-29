---
'@mastra/core': patch
---

Channels: attachments whose type isn't in `inlineMedia` are now still downloaded when the adapter supplies an authenticated `fetchData` (e.g. Slack). Text-like files (`text/*`, JSON, YAML, XML, …) reach the agent as text (capped at 100 KB) and binary files are described by name and type, instead of being passed as an unauthenticated private URL the agent cannot open. Public-URL attachments without `fetchData` behave as before.
