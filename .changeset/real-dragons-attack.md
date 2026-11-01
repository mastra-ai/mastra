---
'@mastra/client-js': patch
---

Fixed request headers being joined with client headers when the names differ only in case. A request `authorization` header now replaces a client `Authorization` header, and an explicit `Content-Type` replaces the JSON default. Fixes [#28667](https://github.com/mastra-ai/mastra/issues/28667).
