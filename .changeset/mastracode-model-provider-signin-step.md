---
'mastracode': patch
---

Redesigned the Factory onboarding LLM step as a sign-in style screen.

- Providers with browser sign-in (Anthropic, OpenAI, GitHub Copilot, xAI) now appear as top-level buttons with their logos; clicking one starts sign-in directly.
- An OR divider leads into a searchable API key provider list; results are capped in height and scroll, and picking an unconnected provider opens the API key dialog directly.
- Once a provider is connected, the step focuses on choosing the Factory default model, with a full-width finish button and a Change provider option.
