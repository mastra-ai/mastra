---
'@mastra/core': patch
---

Fixed durable and evented agents dropping a background task's result when the task had been dispatched but no worker had picked it up yet. The end-of-step background check counted only `running` tasks. On a pubsub with delivery latency, a just-dispatched task was still `pending`, so the agent stopped waiting and the task's result never reached the stream. Pending tasks now count as outstanding.
