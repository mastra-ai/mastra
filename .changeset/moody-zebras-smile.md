---
'@mastra/deployer': patch
---

Fixed Studio not reloading after dev-server restarts, including restarts before the first refresh connection succeeds. Production reconnects do not trigger instance-based page reloads.
