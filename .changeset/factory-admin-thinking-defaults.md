---
'@mastra/factory': patch
---

Added the ability for one organization's admins to edit deployment thinking defaults from Settings when authentication is enabled. Set `MASTRACODE_DEPLOYMENT_ORGANIZATION_ID` to the organization the deployment serves. Only admins of that organization can save the defaults; everyone else sees them read-only. Without the variable, the defaults stay read-only while authentication is enabled.
