---
'@mastra/deployer': patch
---

Fixed builds that disable default externals so optional dependencies guarded by try/catch do not force extra installs.
