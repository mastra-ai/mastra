---
'@mastra/github-signals': patch
---

Fixed GitHub polling so stopping a poll prevents in-flight work from sending notifications or writing subscription state.
