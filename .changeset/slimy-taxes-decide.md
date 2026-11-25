---
'@mastra/core': patch
---

Fixed evented agents losing the assistant message when a tool suspended or asked for approval on a multi-process deployment. When the tool ran in a different worker process from the model call, the thread kept only the user message, so a reloaded client could not show the pending question or approval. The message and its pending-tool record are now saved wherever the tool runs, and a tool answered in another process is no longer shown as pending once the run finishes. Fixes [#30123](https://github.com/mastra-ai/mastra/issues/30123).
