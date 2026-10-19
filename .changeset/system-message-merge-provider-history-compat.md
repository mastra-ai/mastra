---
'@mastra/core': minor
---

Agent calls to OpenAI-compatible Chat Completions providers, including router models that resolve to a Chat Completions endpoint (such as `'groq/...'` or a custom `url`), now send all leading system instructions as one system message. Setting `errorProcessorDefaults: false` turns this merge off.

`processLLMRequest` processors now receive `apiProviderId`: the provider id of the model that will actually be called, for example `groq.chat` or `openai.responses`, where `model.provider` would only say `groq` or `openai`.
