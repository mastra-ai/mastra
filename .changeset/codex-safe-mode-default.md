---
'@mastra/code-sdk': patch
---

Build and plan modes now default to `openai/gpt-5.6-sol` instead of `openai/gpt-5.5`. ChatGPT (Codex OAuth) accounts reject `gpt-5.5`, so sessions with no chosen default that were connected only through Codex failed every message with "model not supported".
