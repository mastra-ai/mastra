---
'@mastra/factory': patch
---

Sessions on a remote sandbox with an absolute `workingDirectory` resolve the checkout at `<workingDirectory>/<repo>` without probing the VM. Sandboxes without one (or with a non-absolute one) keep the probe behavior.
