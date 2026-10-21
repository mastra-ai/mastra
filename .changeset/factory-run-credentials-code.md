---
'@mastra/factory': patch
---

Fixed the dispatcher reporting `run_failed` when a model provider rejected the credentials in its response body instead of with HTTP 401 or 403. Such a failure now reports `run_credentials_unavailable`. An authentication error from another service the run uses, such as GitHub or an MCP server, still reports `run_failed`.
