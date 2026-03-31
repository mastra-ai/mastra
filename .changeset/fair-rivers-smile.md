---
'@mastra/memory': minor
---

Added more forgiving raw message browsing in the recall tool for agent follow-up calls.

When an agent requests a `partIndex` greater than the highest visible part in a message, recall now returns the first visible part from the next visible message instead of failing. This makes it easier for agents using `recall` to keep browsing raw messages even when they guess the wrong part index.
