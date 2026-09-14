---
'@mastra/playground-ui': patch
---

Added `CreateButton` to the design system. It renders a `Plus` icon, binds the `C` key to its click, and shows a tooltip with the text you pass plus a `C` key hint.

```tsx
import { CreateButton } from '@mastra/playground-ui/ds/components/Button';

<CreateButton variant="primary" tooltip="Create a new agent" onClick={openDialog}>
  New agent
</CreateButton>;
```
