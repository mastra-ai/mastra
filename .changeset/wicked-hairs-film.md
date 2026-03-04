---
'@mastra/playground-ui': patch
'@mastra/server': patch
---

Fixed auth capabilities endpoint to return disabled state when dev playground header is present, preventing the login gate from appearing in dev playground mode
