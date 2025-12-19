---
"@mastra/core": patch
---

Some LLMs (particularly when not using native JSON mode) output actual newline characters inside JSON string values instead of properly escaped `\n` sequences. This breaks JSON parsing and causes structured output to fail.

This change adds preprocessing to escape unescaped control characters (`\n`, `\r`, `\t`) within JSON string values before parsing, making structured output more robust across different LLM providers.
