---
'@mastra/code-sdk': minor
---

Added new plugin APIs for authentication-style flows:

- **Callback config options** — plugins can declare `type: 'callback'` config options that run an action (like a browser OAuth flow) from the /plugins Configure screen. The callback can return `{ message, config }` and the returned config patch is persisted and applied immediately.
- **`isEnabled` gating** — tool entries and config options accept an `isEnabled(context)` predicate that shows or hides them based on current config values (fail-closed if the predicate throws). Gating re-evaluates whenever config changes.
- **`init()` hook with request-context state** — plugins can declare `init(context)` to create long-lived state (like an authenticated API client) once per load. Tools read it at execution time via `requestContext.get(PLUGIN_STATE_KEY)[pluginId]`.

```ts
export default defineMastraCodePlugin({
  id: 'slack',
  config: {
    connected: { type: 'boolean', isEnabled: () => false },
    authenticate: {
      type: 'callback',
      label: 'Authenticate',
      isEnabled: ({ config }) => config.connected !== true,
      run: async () => {
        await runOAuthFlow();
        return { message: 'Connected', config: { connected: true } };
      },
    },
  },
  init: async () => ({ client: createClient() }),
  tools: {
    my_tool: { tool, isEnabled: ({ config }) => config.connected === true },
  },
});
```
