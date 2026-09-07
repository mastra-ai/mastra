---
'@mastra/factory': patch
---

Fixed linked repositories not feeding the board by default. Linking a repository to a Factory during onboarding or from Settings › Repositories now also selects it under Work Intake › GitHub issues, as the create-Factory wizard already did, so its open issues show up without a second trip to Settings. Repositories that already feed intake are left untouched.
