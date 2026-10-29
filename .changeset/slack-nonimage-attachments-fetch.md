---
'@mastra/core': patch
---

Channels: text-like attachments whose type isn't in `inlineMedia` (`text/*`, JSON, YAML, XML, …) are now downloaded when the adapter supplies an authenticated `fetchData` (e.g. Slack) and reach the agent as text (capped at 100 KB). Other binary files are described by name and type without being downloaded. Both replace the previous behaviour of being passed as an unauthenticated private URL the agent cannot open. Public-URL attachments without `fetchData` behave as before.
