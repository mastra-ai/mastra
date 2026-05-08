---
'mastracode': minor
---

Added GitHub Copilot OAuth login (`/login` → GitHub Copilot) so anyone with an active Copilot subscription can use Mastra Code without separate OpenAI or Anthropic keys. The flow uses the standard GitHub device code OAuth, supports GitHub Enterprise hosts, and automatically refreshes the short-lived Copilot bearer token.

A new **GitHub Copilot** mode pack is selectable from the onboarding wizard and `/models`. The built-in defaults are:

- _plan_: `github-copilot/gemini-2.5-pro`
- _build_: `github-copilot/gpt-4.1`
- _fast_: `github-copilot/grok-code-fast-1`

After login, the available Copilot models are fetched live from the `/models` endpoint, filtered to picker-enabled, non-policy-disabled entries, and cached for 10 minutes. Mastra Code now uses the generic OpenAI-compatible AI SDK adapter pointed directly at GitHub Copilot's API instead of rewriting OpenAI provider URLs, and applies Gemini-compatible tool schemas for Copilot Gemini models.
