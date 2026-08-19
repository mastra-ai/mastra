---
'@mastra/core': patch
---

Fixed the coding agent's instructions for a message that arrives while it is already working. They described that message as `<user-message delivery="…">`, a tag the runtime never emits, so the rule and the wrapper the agent actually receives (`<user delivery="…">`) never matched by name.

No API change, and no change to how a message is delivered: one that lands mid-work is still marked `while-active` and still meant as context for the work in flight. The instructions now name it the way it arrives.
