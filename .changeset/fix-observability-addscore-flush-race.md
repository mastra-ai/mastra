---
'@mastra/observability': patch
---

Fixed an issue where live workflow scores and feedback could be lost before their trace data reached observability storage. Mastra now logs a warning when it cannot save an annotation.
