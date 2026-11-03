---
'@mastra/factory': patch
---

Tool calls in Factory chats now look the same as in Studio, so failures read clearly:

- A failed command's row shows how it ended, `exit N` or `killed`, and its output ends with the exit code and the error when the command could not run. Before, a command that printed something before failing showed only that output.
- Failed results are shown in red, and results are no longer cut off at 800 characters.
- A successful file edit shows what the edit reported, such as diagnostics, next to the change.
