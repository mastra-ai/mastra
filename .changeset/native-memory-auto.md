---
'@mastra/memory': minor
---

Added native `model: 'auto'` support for Observational Memory. Observer and Reflector models resolve independently from the agent's main model on every call, while explicit model IDs and advanced model configurations stay pinned.

`'auto'` is also the **new default** for `model`, `observation.model`, and `reflection.model`, which previously defaulted to `google/gemini-2.5-flash`. Auto picks `google/gemini-2.5-flash` when `GOOGLE_GENERATIVE_AI_API_KEY` is set, otherwise the low-cost model for the main model's provider (for example `anthropic/claude-sonnet-4-6` → `anthropic/claude-haiku-4-5`, keeping a `mastra/` gateway route), otherwise the main model itself. Set a concrete model ID to keep a fixed model; note that auto can fail where the old default worked if the chosen provider has no reachable credential.

Applications can shape auto without reimplementing it:

- `autoModels` overrides the model picked for a provider, for example `{ openai: 'openai/gpt-5-nano' }`.
- `resolveModel(modelId, { requestContext })` turns the picked ID into a model, so auto can reuse your own credentials and routing.
- `resolveAutoModelId(mainModelId, { autoModels })` previews the model auto would pick, for display in settings UIs.

```ts
new Memory({
  options: {
    observationalMemory: {
      autoModels: { openai: 'openai/gpt-5-nano' },
      resolveModel: (modelId, { requestContext }) => myRouter(modelId, requestContext),
    },
  },
});
```
