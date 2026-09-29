---
'@mastra/editor': patch
---

Fixed stored processor graphs dropping `tools`, `activeTools`, and `toolChoice` after parallel or conditional steps, which caused the next model call to run without the agent's tools.
