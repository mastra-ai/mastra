---
'@mastra/core': patch
---

Fixed a tripwire raised from `processOutputResult` blanking `result.text` while the same result still exposed the full assistant prose on `result.steps[].text` and `result.response.messages`. A caller that logs, redacts or reviews the rejected answer read `""` and concluded the model had produced nothing, while the text went on to be persisted. The same `abort()` from `processOutputStep` or `processOutputStream` did not blank it, so the meaning of `result.text` after a tripwire depended on which hook raised it.

A tripwire now rejects the output without erasing it: `text`, `steps[].text`, `getFullOutput().text` and `response.messages` agree across all three hooks, and the rejection is reported through `result.tripwire` alone. `getFullOutput().text` also no longer resolves to `""` when a `processOutputStream` tripwire ends the stream before any step completes. Fixes #24443.
