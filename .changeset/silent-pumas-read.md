---
'@mastra/inngest': patch
---

Fixed Inngest durable agents ignoring `structuredOutput`. `generate()` now returns the parsed `object` instead of only the JSON `text`, and `stream()`, `resume()`, `resumeGenerate()`, and `observe()` in the same process also expose it. Fixes [#25148](https://github.com/mastra-ai/mastra/issues/25148).
