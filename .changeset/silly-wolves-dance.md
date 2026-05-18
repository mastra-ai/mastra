---
'@mastra/core': minor
---

`publishSkillFromSource()` (and `collectSkillForPublish()`) now return a `files` field containing the full skill source as a tree of `StorageSkillFileNode` entries with base64-encoded blob content — handy for storing a UI-facing copy of a skill alongside its content-addressable tree:

```ts
const { snapshot, tree, files } = await publishSkillFromSource({ source });
// files: StorageSkillFileNode[] — name, mimeType, base64 content per node
```

Existing callers that only destructure `{ snapshot, tree }` are unaffected; the field is additive.

Also adds `parseSkillSnapshotFromFiles()` for parsing skill snapshot frontmatter from a flat file list (used by the registry install flow):

```ts
import { parseSkillSnapshotFromFiles, type SkillSnapshotFile } from '@mastra/core/workspace';

const files: SkillSnapshotFile[] = [{ path: 'SKILL.md', content: '...' }, ...];
const snapshot = parseSkillSnapshotFromFiles(files);
```
