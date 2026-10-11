---
'@mastra/voice-openai-realtime': patch
---

Fixed the `speaker` stream never ending for responses that have no audio. A response that only calls a tool, a text-only response, or a response cut off by a dropped socket never got `output_audio.done`, so its stream stayed open. Anything piping it or waiting for `end` hung, and repeated tool turns piled up pipes until Node printed a `MaxListenersExceededWarning`. The stream now ends on `response.done` (before tools run), and all open streams end when the socket closes or on `close()`/`disconnect()`.

Fixes [#26693](https://github.com/mastra-ai/mastra/issues/26693).
