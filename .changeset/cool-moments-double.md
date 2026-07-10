---
'@mastra/core': patch
---

Fixed Amazon Bedrock OpenAI model calls failing when conversation history contains assistant reasoning parts by omitting replayed reasoning from those prompts.
