---
"@mastra/core": patch
---

**Fixed tool-call arguments being silently lost when LLMs append internal tokens to JSON**

LLMs (particularly via OpenRouter and OpenAI) sometimes append internal tokens like `<|call|>`, `<|endoftext|>`, or `<|end|>` to otherwise valid JSON in streamed tool-call arguments. Previously, these inputs would fail `JSON.parse` and the tool call would silently lose its arguments (set to `undefined`).

Now, `sanitizeToolCallInput` strips these token patterns before parsing, recovering valid data that was previously discarded. Valid JSON containing `<|...|>` inside string values is left untouched. Truly malformed JSON still gracefully returns `undefined`.

Fixes https://github.com/mastra-ai/mastra/issues/13185 and https://github.com/mastra-ai/mastra/issues/13261.
