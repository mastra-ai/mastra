---
'@mastra/client-js': patch
---

Preserve tool-call `providerMetadata` at the message-part level during client-tool continuations.

The stream reducers nested `providerMetadata` inside `toolInvocation`, but the server reads it from `part.providerMetadata` when rebuilding the prompt. As a result the metadata was dropped on the recursive request, and Gemini thinking models (e.g. `gemini-3-flash-preview`) failed the follow-up turn with `Function call is missing a thought_signature in functionCall parts`.
