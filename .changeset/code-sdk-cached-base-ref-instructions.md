---
'@mastra/code-sdk': patch
---

Instruction files read from a base branch, as on an untrusted pull request checkout, are now cached by git object. Each model step no longer runs a blocking git command per instruction file it checks, which stalled every other session in the same process, and a file left unchanged as the base branch moves is not read again.
