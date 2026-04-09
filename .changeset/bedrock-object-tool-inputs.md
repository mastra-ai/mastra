---
'@mastra/core': patch
---

Fix tool call handling for AWS Bedrock Anthropic provider

Some AI SDKs (e.g., AWS Bedrock Anthropic provider) pass tool call arguments as already-parsed objects instead of JSON strings. This caused `JSON.parse` errors in the tool-call handler when using Bedrock.

This fix checks if `value.input` is already an object at the call site. If it is, it bypasses all string sanitization and parsing logic and uses the object directly. If it's a string, it proceeds through the existing sanitization flow.
