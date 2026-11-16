---
'@mastra/code-sdk': patch
---

**Kept a plugin running when its reload fails.** A reload that fails for a plugin that was working (a bad update, a throwing resolver) now keeps the plugin's last good tools, signal providers and version stamp, and records the error as `reloadError` instead of removing the plugin. Disabling, blocking or uninstalling it still removes everything, and the next successful load replaces the kept one.

**Added plugin error notifications.** `PluginManager.onPluginError` reports each distinct reload failure once, along with signal provider errors from running plugins. With no listener, errors still go to `console.warn`.

```ts
const unsubscribe = pluginManager.onPluginError(({ pluginId, message }) => {
  console.error(`[${pluginId}] ${message}`);
});
```
