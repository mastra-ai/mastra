---
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed the Off thinking level leaving some models thinking anyway. Off used to send nothing, so the provider's default decided, and DeepSeek, Alibaba and Cerebras Qwen models think by default.

- Off now turns thinking off where the model allows it: DeepSeek and Alibaba models get their thinking switch set to off, and models that accept a `none` effort (Groq and Cerebras Qwen, Mistral, Grok 4.3) get `none`.
- Models that always think, such as GPT-OSS, Grok 4.5, 4.6 and 4.7, and Perplexity reasoning models, no longer offer Off. A saved Off runs them at their lowest level instead of the provider's default.
- `/think status` and the Default row in `/think` now show the level that actually runs, so a default Off on GPT-OSS reads Low instead of Off.
