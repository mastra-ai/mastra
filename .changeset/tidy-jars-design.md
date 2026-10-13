---
'@mastra/playground-ui': patch
---

Fixed Studio showing a resumed workflow run as Suspended and asking for approval again when the run was resumed outside Studio, for example with `run.resume()` or the `resume-async` endpoint. The run page now shows the run's real progress. Fixes [#26907](https://github.com/mastra-ai/mastra/issues/26907).
