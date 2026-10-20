---
'@mastra/playground-ui': minor
---

The Metrics page's Tokens KPI now counts tokens from traces when the server supports trace aggregation. Older servers, and filters traces can't express (service, request or experiment), keep using token metrics as before. The Metrics date picker also blocks custom ranges that start before the oldest trace the store still keeps.
