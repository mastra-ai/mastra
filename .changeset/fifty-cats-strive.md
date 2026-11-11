---
'@mastra/code-sdk': patch
---

Fixed review sessions on pull requests stalling every other session in the same process. Instruction files from the base branch are now read with non-blocking git calls, once per session, and read again only when the branch moves.
