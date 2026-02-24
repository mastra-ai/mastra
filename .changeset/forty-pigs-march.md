---
'mastracode': minor
---

Added interactive onboarding flow for first-time setup

**Setup wizard** — On first launch, an interactive wizard guides you through:

- Authenticating with AI providers (Claude Max, OpenAI Codex)
- Choosing a model pack (Varied, Anthropic, OpenAI, or Custom)
- Selecting an observational memory model
- Enabling or disabling YOLO mode (auto-approve tool calls)

**Global settings** — Your preferences are now saved to `settings.json` in the app data directory and automatically applied to new threads. Model pack selections reference pack IDs so you get new model versions automatically.

**Custom model packs** — Choose "Custom" to pick a specific model for each mode (plan/build/fast). Saved custom packs appear when re-running `/setup`.

**`/setup` command** — Re-run the setup wizard anytime. Previously chosen options are highlighted with "(current)" indicators.

**Settings migration** — Model-related data previously stored in `auth.json` (`_modelRanks`, `_modeModelId_*`, `_subagentModelId*`) is automatically migrated to `settings.json` on first load.
