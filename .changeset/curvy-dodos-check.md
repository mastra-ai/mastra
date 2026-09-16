---
'@mastra/deployer': patch
---

Fail the build with a non-zero exit code when workspace package subpath imports leak as unresolved bare specifiers. The analyzer collects UNRESOLVED_IMPORT warnings during bundling and throws if any reference a workspace package, which should have been bundled inline. Previously the build exited 0 with broken output.
