---
'mastracode': minor
---

Added GitHub Copilot OAuth login (`/login` → GitHub Copilot) so anyone with an active Copilot subscription can use Mastra Code without separate OpenAI or Anthropic keys. The flow uses the standard GitHub device code OAuth (the same flow used by VS Code), supports GitHub Enterprise hosts, and automatically refreshes the short-lived Copilot bearer token.

A new **GitHub Copilot** mode pack is selectable from the onboarding wizard and `/models`. Models are chosen with Copilot's premium-request multipliers in mind:

- _build_ / _plan_: `github-copilot/claude-sonnet-4.5` (1x premium request)
- _fast_: `github-copilot/gpt-4.1` (0x — included with all paid Copilot plans)

After login, the available Copilot models are fetched live from the `/models` endpoint (filtered to picker-enabled, non-policy-disabled entries), so `/models` shows exactly what your subscription can use — including additional models added by GitHub or your org over time. The catalog is cached for 10 minutes and falls back to a small built-in list if the network request fails.
