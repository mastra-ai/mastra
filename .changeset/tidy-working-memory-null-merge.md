---
'@mastra/memory': patch
---

Fixed schema-based working memory persisting `null` placeholders as literal nulls.

Strict-mode providers (such as OpenAI structured outputs) pad fields they are not updating with `null`, and the working memory merge treats `null` as "delete this field". That worked when the field already existed, but on a first write — or when a nested object was being created for the first time — the padded nulls were stored literally instead of being dropped. So a brand-new working memory could be saved as `{ "role": null }`, and new nested objects kept their `null` placeholders.

Now `null` consistently deletes the field regardless of whether the target already existed, matching the tool's documented contract. The merge also no longer returns the caller's update object by reference on a first write.

```ts
import { deepMergeWorkingMemory } from '@mastra/memory';

// Before: null placeholders survived when there was nothing to merge into
deepMergeWorkingMemory(null, { name: 'Ada', role: null });
// => { name: 'Ada', role: null }
deepMergeWorkingMemory({ name: 'Ada' }, { work: { company: 'Acme', manager: null } });
// => { name: 'Ada', work: { company: 'Acme', manager: null } }

// After: null consistently deletes the field
deepMergeWorkingMemory(null, { name: 'Ada', role: null });
// => { name: 'Ada' }
deepMergeWorkingMemory({ name: 'Ada' }, { work: { company: 'Acme', manager: null } });
// => { name: 'Ada', work: { company: 'Acme' } }
```
