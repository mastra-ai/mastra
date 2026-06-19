---
'mastra': patch
---

Fixed the Connect button for Composio and other tool provider toolkits not appearing in the Agent Builder tools picker when authentication is turned off. The picker expected a signed-in user that never exists in projects without authentication, so it never finished loading existing connections. Toolkit connections now load and the Connect button appears whether or not authentication is configured.
