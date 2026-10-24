---
'@mastra/memory': patch
---

**Fixed** long runs on reasoning models outgrowing the context window.

Observational memory counted reasoning as zero tokens. But providers send reasoning back on every later request. With OpenAI Responses and `store: false`, each step's encrypted reasoning goes back too, often thousands of tokens per step. Most of such a prompt went uncounted, so observation started late or never, and the prompt grew until the provider rejected it.

Reasoning that a provider sends back now counts its text plus the encrypted content, signature or redacted data that goes with it (OpenAI, Anthropic, Gemini). Reasoning without any of these is not sent, and still counts as zero.
