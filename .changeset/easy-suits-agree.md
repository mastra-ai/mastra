---
'@mastra/code-sdk': patch
---

Fixed: mastracode no longer writes session scorer results into the local mastra.db.

The outcome and efficiency scorers run on every session and stored a result row each time, but nothing in mastracode ever read those rows back, so they only made the database grow. Scorer results are now discarded after each run instead of being kept on disk or in memory.

Part of #22056.
