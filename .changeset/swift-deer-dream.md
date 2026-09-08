---
'@mastra/code-sdk': minor
---

Added declarative plugin settings commands with validated boolean, string, and select fields, profile-local data directories, and cancellable interactive thread bindings.

Previously, plugin commands could only submit Markdown prompts. Plugins can now declare a native form without a model call:

```ts
settingsCommands: {
  preferences: {
    label: "Preferences",
    fields: { enabled: { type: "boolean", label: "Enabled" } },
    schema: z.object({ enabled: z.boolean() }),
    resolve: async context => ({ values: await readSettings(context) }),
    save: async (values, context) => writeSettings(values, context),
  },
}
```

The host validates complete submissions and cancels stale forms when their thread or plugin changes.
