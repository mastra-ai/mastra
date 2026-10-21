---
'@mastra/playground-ui': minor
---

Added a `subtle` button variant for a persistent neutral fill. Fixed saved view tabs shifting when selected by using matching button dimensions and removing the selected-only chevron.

```tsx
import { Button } from '@mastra/playground-ui/components/Button';

<Button variant={selected ? 'subtle' : 'default'} aria-pressed={selected}>
  My PRs
</Button>;
```
