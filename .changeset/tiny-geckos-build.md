---
'@mastra/memory': minor
---

Improved conversational continuity when the message window shrinks during observation activation. The agent now preserves `suggestedResponse` and `currentTask` across async buffered observation activation, so it maintains conversational context instead of losing track of what it was doing.

Also improved the Observer's extraction to capture user messages near-verbatim and reduce repetitive observations, and updated the agent's context instructions to treat the most recent user message as the highest-priority signal.
