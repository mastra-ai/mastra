---
'@mastra/core': minor
---

Standardize model configuration across all Mastra components

All model configuration points now accept the same flexible `MastraModelConfig` type as the `Agent` class:

- **Scorers**: Judge models now support magic strings, config objects, and dynamic functions
- **Input/Output Processors**: ModerationProcessor and PIIDetector accept flexible model configs
- **Relevance Scorers**: MastraAgentRelevanceScorer supports all model config types

This change provides:
- Consistent API across all components
- Support for magic strings (e.g., `"openai/gpt-4o"`)
- Support for OpenAI-compatible configs with custom URLs
- Support for dynamic model resolution functions
- Full backward compatibility with existing code

Example:
```typescript
// All of these now work everywhere models are accepted
const scorer = createScorer({
  judge: { model: "openai/gpt-4o" } // Magic string
});

const processor = new ModerationProcessor({
  model: { id: "custom/model", url: "https://..." } // Custom config
});

const relevanceScorer = new MastraAgentRelevanceScorer(
  async (ctx) => ctx.getModel() // Dynamic function
);
```

