---
'@mastra/arize': patch
---

Map the OpenInference `LLM` span kind to the exported `chat` call (`model_inference`) instead of `model_generation` and `model_step`, so Phoenix counts each model call's tokens once. The generation loop and its steps are now `CHAIN` spans.
