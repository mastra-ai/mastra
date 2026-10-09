---
'@mastra/code-sdk': patch
'@mastra/factory': patch
'@mastra/server': patch
---

Factory observational memory now supports automatic model selection per role. `PUT /web/config/om/:role/model` accepts `modelId: 'auto'` to clear that role back to automatic selection, and any other value to pin it. Previously `'auto'` was stored as if it were a model name, which pinned the role to a model that does not exist; automatic roles are now stored as `null` and follow the active main model on every run. The request body is unchanged, so existing callers keep working.

Connecting a model provider or signing in over ACP no longer writes observer or reflector selections, and the unused `POST /web/config/om/provider-defaults` route was removed. Stored settings are applied per run instead of being copied into session state. Settings responses now report each role's intent, its effective model, and whether that model's provider is currently available; `mastra/` models count as available when the Mastra gateway key is configured. If Factory cannot load the saved settings for a run, memory falls back to Auto models and default thresholds, and the thread shows an error explaining that saved choices were not applied.

`MastraCodeConfig.inputProcessors` also accepts a function of `{ requestContext }`, so hosts can choose input processors per request:

```ts
await createMastraCodeAgentController({
  inputProcessors: ({ requestContext }) => (requestContext.get('channel') ? [channelProcessor] : []),
});
```

The server now prevents request payloads from overriding Factory's internal memory-settings context.
