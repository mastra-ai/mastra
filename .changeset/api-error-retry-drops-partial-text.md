---
'@mastra/core': patch
---

Fixed retried API errors leaking the failed attempt's partial text. When a provider streamed some text and then failed mid-stream, and an error processor retried the request, the final answer came out as the failed prefix followed by the recovered answer (for example `"The answer is The answer is 42."`), and the retry request sent the failed prefix back to the model as an assistant message. The failed attempt is now discarded: `text`, `response.messages` and stored messages contain only the recovered answer, and the retry prompt no longer includes the partial output. Text chunks already streamed live from the failed attempt are still delivered to `textStream`/`fullStream` consumers; the step that carries them finishes with reason `retry`.
