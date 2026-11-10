---
'@mastra/factory': patch
---

Factory no longer waits for done and canceled cards to be copied to the new card tables before it starts serving. Open cards are copied first; done cards are copied in the background and appear on the board shortly after startup. Opening a card, or receiving an issue event for it, copies it right away, so a reopened issue keeps its original card. Once the copy finishes, later startups skip it. Startup also logs a single `[factory:timing] boot <n>ms` line, and copy progress and skipped cards are logged as short one-line summaries.
