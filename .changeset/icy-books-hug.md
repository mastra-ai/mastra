---
'@mastra/playground-ui': patch
---

Removed the unused `ElementSelect` export from `@mastra/playground-ui`. Use the `Select` primitives instead.

```tsx
// Before
import { ElementSelect } from '@mastra/playground-ui';

<ElementSelect name="status" value={status} onChange={setStatus} options={['Draft', 'Published']} />;

// After
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui';

<Select name="status" value={status} onValueChange={setStatus}>
  <SelectTrigger>
    <SelectValue placeholder="Select..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="draft">Draft</SelectItem>
    <SelectItem value="published">Published</SelectItem>
  </SelectContent>
</Select>;
```
