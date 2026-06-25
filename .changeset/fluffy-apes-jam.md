---
'@mastra/core': patch
---

Fixed an issue where configuring MASTRA_LICENSE_KEY or MASTRA_EE_LICENSE as 'undefined' or 'null' string literals caused license validation failure errors on startup.
