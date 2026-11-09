---
'@mastra/client-js': patch
---

Exported `parsePartialJson`, a tolerant JSON parser for tool arguments that are still streaming. It repairs truncated JSON so you can read the fields that have arrived so far.

```ts
import { parsePartialJson } from '@mastra/client-js';

parsePartialJson('{"city": "Lis');
// { value: { city: 'Lis' }, state: 'repaired-parse' }
```
