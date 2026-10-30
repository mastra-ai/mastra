---
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/react': minor
'mastra': patch
---

Workspace routes now report `capabilities.hasDynamicFilesystem` when the filesystem comes from a resolver. File routes can't browse that filesystem, so Studio's workspace page now explains that the filesystem is resolved per request instead of showing a file tree that fails to load, and the skill dialog warns admins that skill files can't be written to that workspace.

```ts
const info = await client.getWorkspace('my-workspace').info();

if (info.capabilities?.hasDynamicFilesystem) {
  // The filesystem is created per request by a resolver, so the /fs routes can't browse it
}
```
