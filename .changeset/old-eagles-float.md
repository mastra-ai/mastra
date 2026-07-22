---
'@mastra/code-sdk': patch
'mastracode': patch
---

Added a session notification when a GitHub plugin is automatically updated to its latest version

```ts
const unsubscribe = pluginManager.onGithubPluginsUpdated(pluginNames => {
  console.log(`Updated plugins: ${pluginNames.join(', ')}`);
});

// Call during shutdown.
unsubscribe();
```
