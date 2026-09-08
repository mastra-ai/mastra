---
'@mastra/core': patch
---

Text and reasoning spans now fold into message parts through one shared unit, used by both the live agent-controller message and the persisted message builder. The live message gains the reasoning provider metadata it dropped, the redacted reasoning parts it ignored, and the empty reasoning parts OpenAI needs for `item_reference`, so a running turn and its stored copy no longer disagree.
