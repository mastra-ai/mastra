---
'@mastra/auth-studio': patch
---

Fixed connecting the Mastra Gateway from a local Factory, which failed with "Your Mastra role cannot create gateway keys for this organization" even for organization admins. Requests made to Mastra platform on behalf of the signed-in user now include the origin of the browser request.
