---
'@mastra/ai-sdk': patch
---

Fixed processor middleware so `args.systemMessages` only contains untagged system messages. Tagged processor-owned system messages stay on the message list and are still included in the final model input.
