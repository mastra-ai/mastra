---
'@mastra/playground-ui': patch
'@mastra/server': patch
---

Fixed dev playground auth bypass not working in capabilities endpoint. The client now passes MastraClient headers (including x-mastra-dev-playground) to the auth capabilities endpoint, and the server returns disabled state when this header is present. This prevents the login gate from appearing in dev playground mode.
