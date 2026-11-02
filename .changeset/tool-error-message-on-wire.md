---
'@mastra/server': patch
---

Streamed tool errors now keep their message. An error whose `name` was set (for example `Knowledge page "…" not found.`) used to reach clients as `{ "name": "Error" }` with no message; it now arrives as `{ "name", "message" }`. Stacks are still not sent.
