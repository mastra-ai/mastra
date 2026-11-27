---
'@mastra/factory': patch
---

Factory agents still recover a sandbox that stopped responding with `factory_recreate_sandbox`. The tool now warns that anything not saved outside the sandbox may be lost, instead of assuming a git checkout.
