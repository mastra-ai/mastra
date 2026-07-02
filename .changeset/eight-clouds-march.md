---
'mastra': patch
'@mastra/codemod': patch
'@mastra/deployer': patch
'mastracode': patch
---

Hardened child-process invocations against shell command injection. Package installs and codemod runs now pass arguments as arrays instead of interpolating them into shell strings, the deployer's shared child-process logger rejects arguments containing shell metacharacters, and the login dialog validates auth URLs and opens the browser without a shell. As a side effect, `mastra codemod` now works on project paths containing spaces.
