---
'@mastra/core': minor
---

A scorer's `judge.model` can now be a function of `requestContext`, resolved each time the judge runs, the same way agent models work. Use it to look up a model or its credentials at run time.

Experiment scores sent to observability now include `scorerVersion` when the scorer is a pinned stored scorer, so hosted Studio and other score readers can tell which version of a scorer produced each score.
