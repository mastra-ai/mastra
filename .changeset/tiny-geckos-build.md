---
'@mastra/memory': minor
---

Improved conversational continuity when the message window shrinks during Observational Memory activation. The agent now preserves its suggested next response and current task across activation, so it maintains context instead of losing track of the conversation.

Also improved the Observer to capture user messages more faithfully, reduce repetitive observations, and treat the most recent user message as the highest-priority signal.
