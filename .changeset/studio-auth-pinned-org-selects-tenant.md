---
'@mastra/auth-studio': patch
---

Fixed deployments pinned to an organization (`MASTRA_ORGANIZATION_ID`) serving members under whatever organization their shared Mastra session cookie happened to be on. A member is now served in the pinned organization with their role in that organization, and bearer tokens are verified against it. Signing in to one deployment no longer changes which organization another deployment treats you as.
