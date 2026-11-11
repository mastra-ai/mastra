---
'@mastra/core': patch
---

Improved how DurableAgent and EventedAgent store their run stream (`agent.stream.<runId>`). Each step event now carries only the response messages that changed since the previous step, instead of the whole list, so long runs with large tool outputs no longer store each output once per later step. For a DurableAgent run of 40 steps on Redis Streams, the run stream went from 24 MB to 8.6 MB.

- EventedAgent runs also store workflow events that still repeat the run's step results; that growth is tracked in #29370.
- Callers and `observe()` still report the full list of response messages for each step, including `observe()` from an offset, and an observer that joins mid-run on a pubsub that keeps no history.
- Upgrade the processes that run durable agents and the ones that read their streams together: a reader on an older version reports no response messages for steps published by this version.
