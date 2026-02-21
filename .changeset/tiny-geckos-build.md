---
'@mastra/memory': minor
---

Improved conversational continuity after async buffered observation activation. Background buffered observations now include continuation hints (suggestedResponse and currentTask), so the main agent maintains conversational context when the message window shrinks during activation.

Also improved the Observer's extraction instructions to capture user messages near-verbatim (with discretion for very long messages), reduce repetitive observations with grouping, and updated the main agent's context instructions to treat the most recent user message as the highest-priority signal.
