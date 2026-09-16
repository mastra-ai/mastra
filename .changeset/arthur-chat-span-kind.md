---
'@mastra/arthur': patch
---

Map the OpenInference `LLM` span kind to the exported `chat` call (`model_inference`) instead of `model_generation` and `model_step`, so each model call's tokens are counted once. The generation loop and its steps are now `CHAIN` spans.
