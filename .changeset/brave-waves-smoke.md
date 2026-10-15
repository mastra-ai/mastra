---
'@mastra/factory': patch
'@mastra/code-sdk': patch
'mastra': patch
---

Fixed revoked or invalid OAuth sign-ins showing a raw API error. When Anthropic, OpenAI Codex, GitHub Copilot, xAI, or Kimi For Coding rejects a stored sign-in, the error now says the sign-in was rejected and is reported the same way as a missing sign-in, so hosts can prompt the user to sign in again.
