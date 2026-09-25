---
'@mastra/core': minor
---

AgentController sessions now support automatic observational memory model selection per role. `AgentControllerOMConfig.observerModel`/`reflectorModel` and `session.om.<role>.switchModel({ modelId })` accept `'auto'` to follow the active main model, and `resolveAutoModelId` lets a consumer decide which concrete model an automatic role uses. `session.om.<role>.model()` reports the role's configured intent (`'auto'`, a model ID, or `undefined`) while `modelId()` keeps returning the effective concrete model. `defaultObserverModelId`/`defaultReflectorModelId` remain the concrete fallback, and persisted explicit selections are unchanged.

Dynamic model functions can now return a labeled model, `{ model, id }`, so code that only sees the resolved model object still knows its full `provider/model` ID. Resolved models expose that label as a read-only `id`, and models created from a plain router ID set it automatically.

```ts
const agent = new Agent({
  model: ({ requestContext }) => ({ model: createMyModel(requestContext), id: 'openai/gpt-5.6-sol' }),
});
```
