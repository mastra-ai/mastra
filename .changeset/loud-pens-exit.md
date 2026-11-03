---
'@mastra/factory': patch
---

Failed commands in Factory chats now show how they ended: the output ends with the exit code, and with the error when the command could not run. Before, a command that printed something before failing showed only that output, and after a reload a long output was cut off before its last lines. Command output now shows in full after a reload, as it does live.
