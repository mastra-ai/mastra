---
'@mastra/core': minor
'@mastra/editor': minor
'@mastra/server': patch
---

**Agent Builder features now default to ON**

Admins previously had to explicitly opt every Agent Builder feature in by setting each flag to `true`. This was easy to get wrong: a single missing key would silently hide a section of the UI.

Feature flags under `editor.builder.features.agent` now follow **default-on** semantics: any omitted key resolves to `true`. Admins opt out by setting a key to `false`.

```ts
// Before — every key needed to be true to show the corresponding UI:
new Mastra({
  editor: {
    builder: {
      features: {
        agent: { tools: true, agents: true, workflows: true, memory: true /* ...etc */ },
      },
    },
  },
});

// After — omitted keys are on; opt out by listing them as false:
new Mastra({
  editor: {
    builder: {
      features: {
        agent: { workflows: false }, // everything else is on
      },
    },
  },
});
```

The `browser` feature still requires a valid `configuration.agent.browser` to be enabled — if no browser config is provided, `browser` is silently kept off (no warning), so default deployments stay quiet. An _explicit_ `browser: true` without config still warns, as before.

The `model` feature (model picker visibility) defaults to `true`. Admins lock the picker by setting `model: false`, which still requires `configuration.agent.models.default` to be set.
