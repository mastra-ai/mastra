---
'@mastra/memory': patch
---

Improved observational memory backpressure so it only pauses while buffered observations still need time to become activation-ready. Waiting now ends early when buffering finishes, which reduces unnecessary delays near the message token threshold.
