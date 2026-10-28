---
'@mastra/redis-streams': patch
'@mastra/core': patch
---

Fixed thread stream topics growing without bound for agents without memory, such as the observational memory observer and reflector. Finished runs of these agents are now removed from the topic 30 seconds after they end, like failed runs already were, instead of being kept until the stream length cap.
