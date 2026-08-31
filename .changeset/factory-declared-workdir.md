---
'@mastra/factory': patch
---

Session workdir resolution now uses a remote sandbox's declared `workingDirectory` (`<workingDirectory>/<repo>`) when it is an absolute path, instead of probing the VM's default cwd. Sandboxes without the option keep the probe behavior.
