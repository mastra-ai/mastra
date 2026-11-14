---
'@mastra/connect': patch
---

Changed the default model of the OpenAI create-image tool from `gpt-image-1` to `gpt-image-2.5-sunburst`. OpenAI retired `gpt-image-1` on October 23, 2026, so calls that omitted `model` were failing. The default is now a model that works again.
