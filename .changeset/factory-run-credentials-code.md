---
'@mastra/factory': patch
---

Fixed the dispatcher reporting `run_failed` for a provider authentication failure named only in its body; any authentication failure now reads as `run_credentials_unavailable`, not just HTTP 401 and 403.
