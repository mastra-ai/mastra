---
'@mastra/factory': patch
'mastra': patch
---

New Factories now default to the hybrid model scope everywhere. Onboarding preselects "Company work · personal sessions", and Factories with no saved scope, or one that isn't recognized, are treated as hybrid instead of company account.
