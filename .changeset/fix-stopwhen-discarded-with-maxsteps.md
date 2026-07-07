---
'@mastra/core': patch
---

Fix a custom `stopWhen` being ignored when `maxSteps` is also set. Previously, setting `maxSteps` replaced the user's `stopWhen` with `stepCountIs(maxSteps)`, so the agent could not stop early and ran to the `maxSteps` cap. The two are now composed, so `stopWhen` still fires while `maxSteps` acts as an upper safety cap. Closes #19007.
