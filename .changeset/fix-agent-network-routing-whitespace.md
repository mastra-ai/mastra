---
'@mastra/core': patch
---

Fixed trailing whitespace in Agent Network routing prompt that caused failures with Bedrock-backed Claude models. The routing step's assistant message had a newline and spaces from template literal indentation, which strict providers (AWS Bedrock) rejected with a 400 error. Simple agents were unaffected — only Agent Networks hit this issue.
