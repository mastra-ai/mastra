---
'@mastra/core': patch
---

Fixed threads getting stuck on Anthropic and Bedrock after a step failed mid-thinking. When a step died before the reasoning signature arrived, the leftover unsigned reasoning was replayed as an assistant message with no forwardable content, and the provider rejected every later turn with a 400 ("content field ... is empty"). Prompts now omit assistant messages that contain only unsigned reasoning.
