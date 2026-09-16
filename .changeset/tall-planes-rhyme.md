---
'@mastra/core': patch
---

Added core APIs for converting stored skill file snapshots into blob-backed publication data and safely activating an exact immutable version.

```ts
import { randomUUID } from 'node:crypto';
import { publishSkillFromFiles } from '@mastra/core/workspace';

const sourceVersion = await skillsStorage.getVersion(sourceVersionId);
if (!sourceVersion?.files) throw new Error('Skill version has no files');

const published = await publishSkillFromFiles(sourceVersion.files, blobStore);

await skillsStorage.publishVersion({
  skillId,
  sourceVersionId,
  versionId: randomUUID(),
  snapshot: {
    ...published.snapshot,
    files: published.files,
    tree: published.tree,
  },
});
```

The inherited storage fallback serializes publications per skill within one storage instance. Storage adapters can override it with a native transaction when they need cross-instance coordination.
