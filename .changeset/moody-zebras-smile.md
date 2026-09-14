---
'@mastra/deployer': patch
---

Fixed Studio missing dev-server restarts while reconnecting, including restarts before the first refresh connection succeeds. Production reconnects do not trigger instance-based page reloads.
