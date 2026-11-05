---
'@mastra/code-sdk': patch
---

Instruction files read from a base branch, as on an untrusted pull request checkout, are now cached by git tree. Each model step no longer runs a blocking git command per instruction file it checks, which stalled every other session in the same process.
