---
'@mastra/core': patch
---

Fixed stopping an agent-controller run so it always takes effect. When the model stream hung and never reacted to the abort signal, the session stayed stuck in a running state until the server was restarted; the run now finalizes as aborted a few seconds after the stop request.
