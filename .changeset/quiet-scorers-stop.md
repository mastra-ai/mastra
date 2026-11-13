---
'@mastra/code-sdk': patch
---

Removed the unused outcome and efficiency scorers from Mastra Code sessions. The SDK no longer exports `@mastra/code-sdk/evals` or accepts `disableScoreStorage`.

Before upgrading, remove scorer imports and the storage option:

```ts
import { createMastraCode } from '@mastra/code-sdk';
import { createOutcomeScorer } from '@mastra/code-sdk/evals';

const code = await createMastraCode({ disableScoreStorage: false });
```

After upgrading:

```ts
import { createMastraCode } from '@mastra/code-sdk';

const code = await createMastraCode();
```
