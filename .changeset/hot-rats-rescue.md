---
'@mastra/core': patch
---

Fixed agent tool calls failing when the tool's input schema transforms values, for example a string decoded into a `URL` ([#27259](https://github.com/mastra-ai/mastra/issues/27259)). The call failed with errors like `url: Expected string` and the tool never ran. This happened with most providers other than OpenAI, Anthropic and Google, and with tools that set `strict: false`. The tool now receives the decoded value.
