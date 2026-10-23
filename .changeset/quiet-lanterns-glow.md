---
'@mastra/core': patch
---

The traces list Input column now previews an agent run started by a signal by its contents, instead of the signal as JSON. Skills read `Skill <name>: <contents>`, other non-user signals are prefixed with their tag (for example `system-reminder: CI is red.`), and user signals show their text.
