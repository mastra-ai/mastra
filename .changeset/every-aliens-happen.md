---
'@mastra/playground-ui': patch
'@mastra/server': patch
---

Fixed MastraClient headers (including x-mastra-dev-playground) being passed to the auth capabilities endpoint, enabling proper dev playground detection on the server
