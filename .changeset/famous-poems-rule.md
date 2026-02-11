---
'@mastra/editor': patch
'@mastra/core': patch
---

Fixed stored scorers not being registered on the Mastra instance. Scorers created via the editor are now automatically discoverable through `mastra.getScorer()` and `mastra.getScorerById()`, matching the existing behavior of stored agents. Previously, stored scorers could only be resolved inline but were invisible to the runtime registry, causing lookups to fail.
