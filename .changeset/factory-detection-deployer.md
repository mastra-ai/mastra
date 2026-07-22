---
'@mastra/deployer': minor
---

Added automatic detection of Software Factory projects when the Mastra entry imports and constructs a `MastraFactory` binding. Detected projects receive a `mastra-project.json` manifest in `.mastra/output/` identifying the project type and UI asset location.

Use the lightweight public helper when project-type detection is needed before a full bundle:

```ts
import { analyzeEntryProjectType } from '@mastra/deployer/build';

const projectType = await analyzeEntryProjectType('./src/mastra/index.ts');
```
