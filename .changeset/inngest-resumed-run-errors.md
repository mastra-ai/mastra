---
'@mastra/inngest': patch
---

Fixed resumed Inngest agent streams staying open when the resumed run fails. The stream now ends with the run's error, for example when the final messages cannot be saved after a tool approval. Fixes [#27445](https://github.com/mastra-ai/mastra/issues/27445).
