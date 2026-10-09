---
'@mastra/playground-ui': patch
---

Fixed the Traces "Feedback comment" filter silently ignoring text values. Filtering by comment with "is", "matches", or other text operators now narrows the trace list instead of being dropped.
