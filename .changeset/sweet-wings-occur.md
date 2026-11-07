---
'@mastra/core': patch
---

Fixed client tool results being saved as a second copy of the tool call. When a browser answered a client tool, memory kept the original pending call and stored the call again with its result, so tool cards showed up twice after reloading a thread. The result now completes the stored call, including when the model called a server tool and a client tool in the same step.
