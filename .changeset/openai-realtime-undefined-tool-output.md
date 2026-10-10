---
'@mastra/voice-openai-realtime': patch
'@mastra/voice-inworld': patch
---

Tools that return nothing no longer produce an invalid `function_call_output`. The result is now serialised as `null` instead of being dropped, so the item always carries the required `output` string, matching the xAI realtime provider. The same fix is applied to the Inworld realtime provider, which uses the same `function_call_output` shape. Fixes [#26505](https://github.com/mastra-ai/mastra/issues/26505).
