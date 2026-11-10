---
'@mastra/core': patch
---

Improved how a plain `Agent` stores its run stream. Each step event now carries only the response messages that changed since the previous step, so long runs with large tool outputs no longer store each output once per later step. A 40-step run that took 20 MB of Redis now takes about 6.5 MB, and the log grows in line with the run instead of with the square of its steps.

- `agent.observe()` still reports the full list of response messages for each step, including when it starts from an offset.
- During a rolling upgrade, an observer on an older version reports no response messages for steps published by the new version, so upgrade the processes that run agents and the ones that observe them together.
