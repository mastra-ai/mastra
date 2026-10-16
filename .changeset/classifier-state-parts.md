---
'@mastra/core': patch
---

Fixed `Classifier.decide()` crashing with `state.map is not a function` on decision providers built for `@ai-sdk/provider` 4.0.25 and newer, such as `@ai-sdk/typesafe-ai` 3.0.16+. String and JSON state are now converted to `text` and `json` parts before the provider is called, matching the AI SDK. Arrays are passed through only when every element is already a state part; other JSON arrays are wrapped in a `json` part.
