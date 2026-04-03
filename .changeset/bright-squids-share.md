---
"@mastra/core": patch
---

**Fixed streamed finish metadata being dropped from final model results**

Provider-specific metadata from streamed `finish` events is now preserved consistently across final output results, buffered steps, and `onFinish` callbacks. This improves compatibility with providers like Anthropic and Google/Gemini when they attach cache, reasoning, or other finish-time metadata during streaming.
