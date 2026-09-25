---
'@mastra/server': patch
---

Fixed concurrent A2A `message/stream` follow-ups to a task waiting for input starting duplicate agent runs. Only one follow-up now resumes the suspended run; the others wait and receive the final task, so task state and history are no longer overwritten.
