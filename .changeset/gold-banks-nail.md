---
'@mastra/factory': patch
---

Fixed a Factory reconnect bug where reconnecting a sandbox after a role or token change could reauthorize a stale GitHub token refresh context, causing the current context to fail with "GitHub token refresh no longer matches the active Factory workspace role". Reconnects now preserve the existing token authority and only re-target token injection to the current sandbox (#23543).
