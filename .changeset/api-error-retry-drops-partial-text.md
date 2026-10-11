---
'@mastra/core': patch
---

Fixed retried API errors leaking the failed attempt's partial text.

A provider could stream some text, fail mid-stream, and then succeed when an error processor retried. The final answer came out as the failed prefix followed by the recovered answer, for example `"The answer is The answer is 42."`. The retry request also sent the failed prefix back to the model.

The failed attempt's partial text is now discarded, for both `Agent` and durable agents. The final `text` and the retry prompt no longer include it, and neither do `response.messages` and stored messages. Steps that completed before the failed attempt are kept.

Text chunks already streamed live from the failed attempt still reach `textStream` and `fullStream` consumers. The step that carries them finishes with reason `retry`.
