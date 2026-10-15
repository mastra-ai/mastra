---
'@mastra/factory': patch
---

Signing in to a model subscription now prefills the default model. A personal sign-in sets your default (for example `openai/gpt-5.6-sol` for ChatGPT, `anthropic/claude-fable-5` for Claude) when you have none; an org-wide sign-in does the same for every Factory in the org without a default. Defaults you already chose are never changed.
