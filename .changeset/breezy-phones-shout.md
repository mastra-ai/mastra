---
'@mastra/factory': patch
---

Improved Factory default model changes to ask whether running work and review sessions should switch too. New runs always use the saved default; existing sessions keep their current model unless the user explicitly switches them, and switched sessions adopt the new model on their next step.
