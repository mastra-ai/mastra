---
'@mastra/code-sdk': patch
---

Fixed Mastra Code saying a subscription sign-in expired (and cycling through every account) when it just couldn't reach the provider to renew it: offline, flaky wifi, a timeout, a rate limit, a server error, or a wifi login page. This applies to Anthropic, OpenAI Codex, GitHub Copilot, xAI and Kimi For Coding. It now reports a network error and keeps the saved sign-in, so the next message works once the connection is back. A sign-in the provider actually rejects still asks you to sign in again.
