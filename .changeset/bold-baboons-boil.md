---
'@mastra/code-sdk': minor
---

Moved model packs in Mastra Code web to database-backed storage and refreshed the built-in packs.

**Model packs are now stored in the Factory database**

When running with a Factory backend, custom model packs are saved in a new model-packs storage domain scoped to your organization instead of the local settings.json file. Local (non-tenant) mode keeps the file-backed behavior.

**Pick from available models**

The settings Model tab now loads the list of available models from a new /web/config/models endpoint, so the Factory default model picker and model pack editor only offer models you actually have credentials for. Model pickers are searchable comboboxes instead of plain dropdowns, and pack activation now resolves the correct scoped session so packs can be activated from settings.

**Default packs updated to the latest model releases**

- Anthropic: build and plan anthropic/claude-fable-5, fast anthropic/claude-haiku-4-5
- OpenAI: build and plan openai/gpt-5.6
- Observational memory default model is now google/gemini-3.5-flash
