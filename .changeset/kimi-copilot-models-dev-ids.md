---
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed Kimi For Coding, GitHub Copilot and custom provider model selection. These models now appear in `/models`, `/setup`, `/model` and `/om` under the ids Mastra Code resolves (`kimi-code-plan-cn/k3`, `github-copilot/gpt-4.1`, `<custom-provider>/<model>`) instead of `mastracode/kimi-for-coding/k3`, `mastracode/github-copilot/...` and `mastracode/<custom-provider>/...`. Picking a Kimi or Copilot row used to save an id that failed with "Could not find config for provider mastracode".

Your Kimi login or `KIMI_API_KEY` now authenticates the models.dev `kimi-code-plan-cn` provider. Model ids you already saved keep working: `kimi-for-coding/<model>`, `mastracode/kimi-for-coding/<model>` and `mastracode/github-copilot/<model>` resolve to the current providers.
