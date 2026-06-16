---
'@mastra/client-js': patch
---

Fixed client tools ignoring `toModelOutput`. Client tools defined with a `toModelOutput` function now send their transformed output to the model, the same way server tools do. Previously the mapping was silently skipped for client tools, so multimodal tool results (for example screenshots returned as images) reached the model as stringified JSON instead of native image content. The raw tool result is still preserved for storage and application logic; only what the model sees changes. Fixes https://github.com/mastra-ai/mastra/issues/17792
