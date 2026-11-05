---
'@mastra/core': patch
---

Fixed agent tool calls failing when the tool's input schema transforms values, for example a string decoded into a `URL` ([#27259](https://github.com/mastra-ai/mastra/issues/27259)). The call failed with a validation error such as `url: Invalid input: expected string, received URL` and the tool never ran. This happened with models that have no schema compatibility layer in Mastra (for example Mistral or Qwen models), and with tools that set `strict: false`. The tool now receives the decoded value.
