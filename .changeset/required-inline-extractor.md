---
'@mastra/memory': minor
---

Added a `required` option to `Extractor`. Set it to require an inline section in single-thread observer and reflector calls. A missing section is recorded in `extractionFailures`. The model is told to write `UNCHANGED` when nothing changed, and that value is skipped rather than stored. Batched multi-thread observer calls still treat the section as optional. Extractors that resolve to a `schema` ignore this option.

```ts
import { Extractor } from '@mastra/memory';

const mood = new Extractor({
  name: 'Mood',
  instructions: "Describe the user's current mood in one sentence.",
  required: true,
});
```
