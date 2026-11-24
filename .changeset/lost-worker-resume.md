---
'@mastra/factory': patch
---

A Factory phase run whose worker stopped mid-run now resumes on the worker that picks its kickoff back up. Previously the reclaimed kickoff was taken as already done, so the card stayed in its phase with nobody working on it. The lost run is recorded as aborted and the session gets a continuation telling it to pick up where it left off.
