---
'@mastra/ai-sdk': patch
---

Remove OpenAI text item references from UI streams when reasoning is hidden, so persisted UI messages can be replayed without referencing a message whose required reasoning item was omitted. Preserve provider linkage when `sendReasoning: true` and leave unrelated provider metadata unchanged.
