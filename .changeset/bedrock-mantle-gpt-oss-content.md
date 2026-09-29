---
'@mastra/core': patch
---

Fixed Agents failing on AWS Bedrock Mantle with `openai.gpt-oss-*` models (for example `openai.gpt-oss-20b`) with `Invalid 'messages': Invalid 'content'`. Multi-part text user messages are now sent as a single text block for these models, so they serialize the way Mantle expects. Stored conversation history is unchanged.
