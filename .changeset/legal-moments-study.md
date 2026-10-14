---
'@mastra/observability': patch
'@mastra/core': patch
---

Fixed Amazon Bedrock India inference profiles (`in.` prefix, e.g. `in.anthropic.claude-sonnet-5`) sending `temperature` to models that reject it, which returned a 400. They now resolve model capabilities like the other geography prefixes. Fixes #26387.
