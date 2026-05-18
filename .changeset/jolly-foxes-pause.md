---
'@mastra/core': minor
---

`publishSkill` now returns the full skill file tree so consumers can persist the UI-facing tree alongside storage blobs without re-walking the source.

```ts
import { publishSkill } from '@mastra/core/workspace';

const result = await publishSkill({ workspace, skillId, source });

// New: nested tree of folders + files; binary content base64-encoded.
for (const node of result.files) {
  console.log(node.type, node.path);
}
```

Also added two optional capability methods to `IMastraEditor` for server-side gating of builder-aware behavior:

```ts
interface IMastraEditor {
  // ...existing members...
  hasEnabledBuilderConfig?(): boolean;
  resolveBuilder?(): Promise<IAgentBuilder | undefined>;
}
```

Both methods are optional — existing implementations of `IMastraEditor` continue to work unchanged. Servers that consume them treat `undefined` / missing implementation as "no builder configured."
