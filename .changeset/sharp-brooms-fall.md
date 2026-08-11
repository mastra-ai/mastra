---
'@mastra/core': patch
---

Fixed two thread-stream broadcast issues when subscribing to agent threads. Broadcast copies of step-start, step-finish, and finish parts no longer embed the raw model request body or duplicated step history, preventing multi-gigabyte pubsub streams and out-of-memory crashes when threads contain large media (#21219). Runs that failed before persisting any messages no longer replay as phantom partial messages to new thread subscribers on retained backends like Redis Streams (#21223).
