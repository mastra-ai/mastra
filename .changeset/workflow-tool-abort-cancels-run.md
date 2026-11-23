---
'@mastra/core': patch
---

Fixed workflows exposed to agents as tools continuing to run after the tool call was cancelled. Aborting the agent call, cancelling the background task, or hitting its timeout now cancels the workflow run too. Fixes [#29890](https://github.com/mastra-ai/mastra/issues/29890).
