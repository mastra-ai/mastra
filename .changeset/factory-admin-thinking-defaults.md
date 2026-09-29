---
'@mastra/factory': patch
---

Auth-enabled Factory deployments can now let one organization's admins edit the deployment thinking defaults from Settings. Set `MASTRACODE_DEPLOYMENT_ORGANIZATION_ID` to the organization the deployment serves. Only admins of that organization can save the defaults; everyone else sees them read-only. Without the variable, the defaults stay read-only while authentication is enabled.
