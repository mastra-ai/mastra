---
'@mastra/core': patch
---

Reduced the size of persisted agent loop snapshots by dropping the copy of the agent's system prompt that was stored in every step's exported span data.

Durable agents persist a run snapshot at every step boundary. Each step result carried `agentSpanData.attributes.instructions`, the agent's full system prompt, on both its input and its output side, so a long turn rewrote that prompt dozens of times. Nothing read those copies back: a resumed run rebuilds its agent span from the snapshot's initial input, which is left untouched, so traces are unaffected.

Measured over 300 production snapshots, this removed 27.7 MB of 518.1 MB persisted, about 5% of all snapshot bytes written.
