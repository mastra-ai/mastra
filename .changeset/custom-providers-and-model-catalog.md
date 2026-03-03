---
"@mastra/core": patch
"mastracode": patch
---

Add first-class custom provider support for MastraCode model selection and routing.

- Add `/custom-providers` command to create, edit, and delete custom OpenAI-compatible providers and manage model IDs under each provider.
- Persist custom providers and model IDs in `settings.json` with schema parsing/validation updates.
- Extend Harness model catalog listing with `customModelCatalogProvider` so custom models appear in existing selectors (`/models`, `/subagents`).
- Route configured custom provider model IDs through `ModelRouterLanguageModel` using provider-specific URL and optional API key settings.
