---
'@mastra/code-sdk': patch
'mastracode': patch
'@mastra/factory': patch
---

Fixed model selection for Kimi For Coding, GitHub Copilot and custom providers in `/models`, `/setup`, `/model` and `/om`. Picking a Kimi or Copilot model no longer saves an id that fails with "Could not find config for provider mastracode".

These models are now listed under ids that resolve:

- Kimi: `kimi-code-plan-cn/<model>` (your Kimi login or `KIMI_API_KEY` authenticates it)
- GitHub Copilot: `github-copilot/<model>`
- Custom providers: `<custom-provider>/<model>`

Ids you already saved keep working: `kimi-for-coding/<model>`, `mastracode/kimi-for-coding/<model>` and `mastracode/github-copilot/<model>`.

A Kimi API key saved in `/api-keys` or Factory's provider settings is now used for Kimi models, and a Kimi login shows as connected in `/api-keys`.
