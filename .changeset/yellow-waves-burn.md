---
'@mastra/core': patch
---

Removed a catch that hid a broken durable run. When a durable run's state could not be read between iterations, the loop kept going and crashed one step later with an error that pointed at the wrong place. It now fails where the unreadable state is found, carrying the real cause.
