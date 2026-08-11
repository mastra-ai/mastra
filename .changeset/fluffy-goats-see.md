---
'@mastra/code-sdk': minor
---

Added `processors` and `signalProviders` to the Mastra Code plugin contract, so a plugin can contribute more than tools.

**Processors**

A plugin can now extend the agent pipeline directly, passing a bare array for input processors or an object for both lanes. Plugin processors run after the processors Mastra Code configures and before the channel and memory layers the Agent appends. The slot isn't configurable, and the processors are resolved before every LLM call. Enabling, disabling, or updating a plugin applies on the next request instead of requiring a restart.

**Signal providers**

A plugin can also ship a signal provider, which monitors an external source and pushes notifications into a thread. Providers are long-lived, so the SDK owns their lifecycle instead of handing them to the agent: it registers Mastra on them, connects them to the coding agent, starts them polling, and stops them when the plugin is updated, disabled, or uninstalled. That makes a provider installed from a GitHub repository survive a mid-session update of that repository. Only one provider with a given id runs at a time, and a provider that fails to start is isolated from the rest of its plugin.

Field resolvers also receive `getController()` and `getActiveSession()` on the plugin context, so a plugin can read the running session lazily at the moment it needs it.

For embedders that inject their own `pluginManager` into `createMastraCode`: the `PluginManager` contract now also requires `onReload`, `getPluginSignalProviders`, and `setRuntime`, so hand-built manager implementations must add these methods.
