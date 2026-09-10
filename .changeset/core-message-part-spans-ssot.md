---
'@mastra/core': patch
---

Text and reasoning spans now fold into message parts through one shared unit, used by both the live agent-controller message and the persisted message builder. The live message gains the redacted reasoning parts it ignored and the empty reasoning parts OpenAI needs for `item_reference`, no longer draws an empty text part for a text block that never streamed, and keeps provider metadata off its parts since nothing live sends them back to a provider, so a running turn and its stored copy agree on every visible part.
