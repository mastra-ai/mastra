---
'mastra': patch
---

Fixed `mastra api factory work-item list` ignoring its filters. The command now accepts JSON input, so `sessionId`, `scope`, `started`, `q`, `limit` and `source` reach the server, for example `mastra api factory work-item list <project-id> '{"started":"false","q":"login flow"}'`.

Fixed list filters on Factory commands. A list such as `{"source":["a","b"]}` or `{"kind":["automation-failed","agent-waiting"]}` on `mastra api factory attention list` is now sent the way Factory reads it, instead of being rejected or matched as one literal value.
