---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/client-js': patch
---

Allow `reviewStatus` to be set when creating feedback (defaults to `needs-review`). Studio thumbs up/down ratings from experiment review are now created as `reviewed` so they don't show up in the inbox.
