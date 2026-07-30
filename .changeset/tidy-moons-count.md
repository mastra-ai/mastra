---
'@mastra/factory': patch
---

Fixed `factory_transition_work_item` rejecting long rationales. Overly long rationales are now truncated server-side instead of failing validation, which previously caused agents to burn several retry round trips at the end of every run. Skill guidance now steers toward sentence-length rationales instead of a character count.
