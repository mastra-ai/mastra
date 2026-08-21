---
'@mastra/platform-workspace': minor
---

Added asynchronous sandbox template builds and reusable template handles for Platform workspaces.

```ts
const templates = new PlatformTemplateClient();
const build = await templates.build({ environmentId, definition });
const ready = await templates.waitUntilReady({ environmentId, templateId: build.templateId });
const sandbox = new PlatformSandbox({ environmentId, templateId: ready.templateId, templateDefinition: definition });
```

Template environment values are serialized and must not contain secrets.
