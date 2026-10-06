---
'@mastra/memory': patch
---

Fixed Observational Memory saving a cut-off or empty observation when the observer or reflector model call failed partway through. This covered streams that ended early (for example Gemini reporting a finish reason of `other`) and transient provider errors such as a 429 or 500. These calls now retry the whole request from the original prompt instead of continuing from the partial reply, so only complete replies are saved. Fixes [#24810](https://github.com/mastra-ai/mastra/issues/24810).
