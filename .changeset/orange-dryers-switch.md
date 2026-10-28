---
'@mastra/core': patch
---

Fixed thread stream topics using far more memory than needed for agents without memory, such as the observational memory observer and reflector. Their finished runs, successful or failed, stayed on the topic until the stream length cap pushed them out. Both are now removed 30 seconds after the run ends.
