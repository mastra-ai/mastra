---
'@mastra/core': patch
---

Fixed the streamed reply splitting differently from the stored one. When the agent's turn was interrupted mid-run — a message sent while it was working, a resumed tool approval, a state signal — the live stream kept everything in one assistant message while storage had already sealed it and opened a new one. Coming back to the thread (tab switch, reload) replayed the second half as an extra copy. The stream now closes its message at the same boundary the run loop does.
