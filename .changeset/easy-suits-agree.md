---
'@mastra/code-sdk': patch
---

Fixed: mastracode no longer writes session scorer results into the local mastra.db.

The outcome and efficiency scorers run on every session and stored a result row each time, but nothing in mastracode ever read those rows back, so they only made the database grow. The scorer results now stay in memory for the lifetime of the session.

Part of #22056.
