---
'@mastra/code-sdk': patch
---

Fixed Mastra Code showing "Anthropic sign-in expired" and cycling through every account when it couldn't reach Anthropic to renew the sign-in (offline, flaky wifi, a timeout, or a server error). It now reports a network error and keeps the saved sign-in, so it works again once the connection is back. A sign-in Anthropic actually rejects still asks you to sign in again.
