---
'@mastra/memory': patch
---

Fixed Observational Memory saving a cut-off observation when the observer or reflector model stream ended early (for example Gemini reporting a finish reason of `other`). These calls now retry the whole request instead of continuing from the partial reply, so only complete replies are saved. Fixes [#24810](https://github.com/mastra-ai/mastra/issues/24810).
