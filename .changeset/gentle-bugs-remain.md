---
'@mastra/auth-clerk': patch
---

Fixed a stored XSS advisory in Clerk by updating @clerk/backend to 3.17.2. `createClerkClient` and the rest of the Mastra Clerk auth API are unchanged.
