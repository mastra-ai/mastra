---
'@mastra/core': patch
---

Fixed model call spans that listed tools the model did not receive. Each `MODEL_INFERENCE` span now has a `tools` attribute with the tool definitions (name, description, parameters) sent to the provider on that call, after input processors, `prepareStep`, `activeTools`, and `toolChoice` are applied. `availableTools` on the same span now matches it: it is empty when `toolChoice` is `'none'` and structured output is requested directly, and it no longer lists names that are not registered tools.
