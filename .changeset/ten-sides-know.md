---
'@mastra/evals': minor
'@mastra/core': minor
---

Standardize model configuration across all components to support flexible model resolution

All model configuration points now accept `MastraModelConfig`, enabling consistent model specification across:
- Scorers (`createScorer` and all built-in scorers)
- Input/Output Processors (`ModerationProcessor`, `PIIDetector`)
- Relevance Scorers (`MastraAgentRelevanceScorer`)

**Supported formats:**
- Magic strings: `'openai/gpt-4o-mini'`
- Config objects: `{ id: 'openai/gpt-4o-mini' }` or `{ providerId: 'openai', modelId: 'gpt-4o-mini' }`
- Custom endpoints: `{ id: 'custom/model', url: 'https://...', apiKey: '...' }`
- Dynamic resolution: `(ctx) => 'openai/gpt-4o-mini'`

This change provides a unified model configuration experience matching the `Agent` class, making it easier to switch models and use custom providers across all Mastra components.

