---
'@mastra/code-sdk': patch
---

Improved responsiveness of sessions that load instruction files from a base branch, as on an untrusted pull request checkout. Repeated model steps reuse cached reads instead of running git again for each instruction file they check, which stalled every other session in the same process. After the base branch moves, only files whose content changed are read again.
