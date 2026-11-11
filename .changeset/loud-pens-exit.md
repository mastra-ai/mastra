---
'@mastra/factory': patch
'mastra': patch
---

Factory chats now show how a tool call failed and what it reported:

- A failed command's row shows how it ended: `exit N`, `killed`, `timed out`, or `error` when the sandbox could not run it. Its output keeps everything it printed and ends with the exit code, plus the full error when the command could not run. Before, a command that printed something before failing showed only that output.
- Failed results are shown in red, and results are no longer cut off at 800 characters.
- A successful file edit shows what the edit reported, such as diagnostics, next to the change.
- While a command runs, you can scroll up through its output without it jumping back to the latest line on every update.
