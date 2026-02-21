---
'@mastra/core': minor
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/server': patch
---

Added targetVersionId support to experiment config, allowing experiments to pin to a specific agent version snapshot resolved via the editor. Falls back to registry lookup when editor is unavailable.
