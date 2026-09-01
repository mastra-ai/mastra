---
'@mastra/core': minor
---

Added trusted author metadata for dynamic workflow registration.

```ts
await mastra.addDynamicWorkflow(definition, { authorId: verifiedUserId });
```

The author is persisted with the definition and remains outside untrusted workflow JSON. This metadata does not enforce access control.

See [#21444](https://github.com/mastra-ai/mastra/issues/21444) for the remaining tenant-isolation design.
