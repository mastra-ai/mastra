---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed agent runs that never finished when a processor tripwire fired after a tool step. The stream output now reports status `tripwire`, and Agent Controller sessions end the run with an error that includes the processor's reason instead of staying busy forever.
