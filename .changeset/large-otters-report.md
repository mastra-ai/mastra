---
'@mastra/client-js': patch
---

Fixed the agent controller types so they match what the server actually sends. The REST types are now derived from the route contracts the server publishes instead of being maintained by hand, so they can no longer drift.

Three types were describing fields that never arrive over the wire:

- `AgentControllerAvailableModel.apiKeyEnvVar` — the models route sends `id`, `provider`, `modelName`, `hasApiKey` and `useCount` only. The field is gone; reading it was always `undefined`.
- `AgentControllerThreadInfo` — now the thread shape `listThreads()` actually returns (`id`, `title`, `updatedAt`, `tags`, `state`). It no longer claims `resourceId` and `createdAt`, which that route does not send.
- `createThread()` and `cloneThread()` return the new `CreateAgentControllerThreadResponse` (`id`, `title`, `resourceId`, `createdAt`, `updatedAt`), which is a different shape from a listing entry.

Only `apiKeyEnvVar` needs action on your side. If you read it to tell whether a model is usable, read `hasApiKey` instead:

```ts
const models = await client.getAgentController('my-controller').listModels();

// Before: typed string | undefined, undefined at runtime, so always empty
const usable = models.filter(model => model.apiKeyEnvVar);

// After
const usable = models.filter(model => model.hasApiKey);
```

The thread types need no migration: `listThreads()`, `createThread()` and `cloneThread()` each infer the shape their own route returns.

`PermissionPolicy`, `ToolCategory` and `AgentControllerTaskSnapshot` are now re-exported from `@mastra/core` rather than redeclared, so the SDK and core can't disagree about them. `AgentControllerActiveRun` is now exported from the package root alongside the other agent controller types.
