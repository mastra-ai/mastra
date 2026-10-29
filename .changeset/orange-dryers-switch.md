---
'@mastra/core': patch
---

Fixed thread stream topics using far more memory than needed for agents without memory, such as the observational memory observer and reflector. The output of their finished runs, successful or failed, stayed on the topic until the stream length cap pushed it out. It is now removed 30 seconds after the run ends. Each run's final outcome stays on the topic, so subscribers that reconnect can still see how it ended.
