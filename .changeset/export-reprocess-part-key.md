---
'@mastra/core': patch
---

Exported `REPROCESS_PART_KEY` from `@mastra/core/processors`, so a custom output processor can emit two chunks for one input. Return the first chunk from `processOutputStream`, set the second on `state` under this key, and Mastra emits it right after. Built-in processors such as `BatchPartsProcessor` already use this; a processor outside core no longer has to copy the key's internal string.

```ts
import { REPROCESS_PART_KEY } from '@mastra/core/processors';

async processOutputStream({ part, state }) {
  if (part.type !== 'text-end' || state.signed) return part;
  state.signed = true;
  state[REPROCESS_PART_KEY] = part; // sent after the delta below
  return { ...part, type: 'text-delta', payload: { id: part.payload.id, text: '\n\nCheers!' } };
}
```
