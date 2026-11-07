---
'@mastra/auth-better-auth': patch
---

Updated `better-auth` to 1.7.16 so authentication uses that release's session and verification fixes. Revoked sessions are no longer treated as active when they are missing from secondary storage or the cookie cache, and phone, email, and OAuth verification stay tied to the account that requested them.
