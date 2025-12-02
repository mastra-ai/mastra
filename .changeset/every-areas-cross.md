---
'@mastra/observability': patch
---

Fix SensitiveDataFilter to redact structured data in JSON strings

- Fixed issue where SensitiveDataFilter failed to redact tool results in MODEL_STEP span input messages ([#9846](https://github.com/mastra-ai/mastra/issues/9846))
