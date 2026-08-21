---
'@mastra/code-sdk': patch
---

SandboxFilesystem read operations (stat, readFile, readdir) issue a single sandbox exec instead of two.
