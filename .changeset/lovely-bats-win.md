---
'@mastra/server': patch
---

Fixed SSO callbacks to return identity provider errors instead of reporting a missing authorization code. Invalid callbacks containing both a code and an error are rejected.
