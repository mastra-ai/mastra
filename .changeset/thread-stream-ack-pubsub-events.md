---
'@mastra/core': patch
---

Acknowledge thread-stream pubsub deliveries so persistent backends stop accumulating pending entries. The thread subscriber and the remote-run waiter now ack every event they inspect (including filtered-out ones) and nack when processing throws; the remote-run waiter also waits for the terminal event's ack before unsubscribing.
