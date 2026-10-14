---
'@mastra/factory': patch
'@mastra/code-sdk': patch
---

Fixed the missing provider credential error to say which credential scope the session uses. An organization-scoped Factory now reports that it uses organization credentials only, so a personal provider sign-in is not used; a personal-scoped session reports the reverse.
