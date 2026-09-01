---
'@mastra/factory': patch
---

Fixed session activity lagging behind reality. The server now announces every run start and end, every decision transition, and every workspace materialization on the project feed stream, so board cards, sidebar rows, and the open chat refresh the moment something happens instead of waiting on the next poll. Every poll slows to one safety tick per 30 seconds while the stream is connected, and resumes its full cadence the moment the stream drops.
