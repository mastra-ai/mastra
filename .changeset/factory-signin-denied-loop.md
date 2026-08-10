---
'@mastra/factory': patch
---

Fixed the sign-in callback redirecting straight back to the identity provider in a loop when it denies access (for example access_denied for an account that is not part of the organization). The denial now lands on the sign-in page with the error shown.
