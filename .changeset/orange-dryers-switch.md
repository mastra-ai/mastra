---
'@mastra/core': patch
---

Fixed thread stream topics growing without bound for agents without memory, such as the observational memory observer and reflector. Their finished runs, successful or failed, were never removed from the topic and piled up until the stream length cap. Both are now removed 30 seconds after the run ends.
