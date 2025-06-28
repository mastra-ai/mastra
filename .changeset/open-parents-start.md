---
'@mastra/voice-openai-realtime': patch
---

Modified the send method of OpenAIRealtimeVoice to encode Int16Array as base64 before sending it to OpenAI. ( Issue: https://github.com/mastra-ai/mastra/issues/5516 )
