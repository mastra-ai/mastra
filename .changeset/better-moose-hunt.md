---
'@mastra/core': patch
---

Fixed workspace trace data sanitization to normalize camelCase and uppercase field names (e.g. accessToken, clientSecret, ENV) before applying redaction rules, and added circular reference protection to prevent stack overflows on self-referential objects
