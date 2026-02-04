---
'@mastra/core': patch
---

Fixed custom input processors from disabling workspace skill tools in generate() and stream(). Custom processors now replace only the processors you configured, while memory and skills remain available. Fixes #12612.
