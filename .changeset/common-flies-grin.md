---
'@mastra/factory': patch
---

Fixed Factory builds approved by someone other than the plan's owner starting in a new, empty session. The build now continues in the plan's session so it keeps the plan, and the planning agent stops once the build starts. Comments and edits on a GitHub issue no longer restart triage while its card is being built or reviewed ([#25230](https://github.com/mastra-ai/mastra/issues/25230)).
