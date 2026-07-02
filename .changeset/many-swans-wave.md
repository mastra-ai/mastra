---
'@mastra/inngest': patch
---

Removed the unused @opentelemetry/core dependency. It was left over from an earlier tracing workaround and pulled a vulnerable version (GHSA-8988-4f7v-96qf) into installs.
