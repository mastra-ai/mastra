---
'@mastra/core': patch
---

Fixed `isBadRequestError` retrying invalid API key errors. Newer OpenAI provider versions report `invalid_api_key` stream errors with status 400, so they were retried as bad requests instead of failing right away. Authorization errors now stay terminal.
