---
'@mastra/playground-ui': patch
---

Fixed the trace timeline for traces with more than one top-level span, such as an agent run followed by a live scorer run. Each run now shows its own duration instead of lasting until the trace ends, and the time axis fits every run. Fixes [#27234](https://github.com/mastra-ai/mastra/issues/27234)
