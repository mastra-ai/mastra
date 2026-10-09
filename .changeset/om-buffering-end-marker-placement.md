---
'@mastra/memory': patch
---

Fixed observational memory buffering end markers going missing from saved message history, and a rare case where an agent's final response content could be overwritten.

When background buffering finished, its end marker was written onto the newest assistant message, usually one the agent was still streaming. The agent's next save of that message dropped the marker. If the agent's last save landed while the marker was being written, the marker write could replace the agent's newer content. The end marker now goes on the message that carries the cycle's start marker, and the message the agent is streaming is never rewritten. The start marker likewise only goes on a message created before the cycle started, so the end marker can always find it.
