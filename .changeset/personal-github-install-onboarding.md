---
'@mastra/factory': patch
---

When no GitHub installation is accessible, `/web/github/status` now includes a `userConnectionReason` field that says why (for example `no-accessible-installation` or `verification-unavailable`). Failed user-connection lookups are now logged as warnings instead of being silently treated as "not connected".
