---
'@mastra/playground-ui': minor
---

Added a shared `Plan` component for rendering markdown plan previews with status, copy, action slots, and collapsed-content controls.

```tsx
import { Plan } from '@mastra/playground-ui/components/Plan';

<Plan title="Review migration plan" path="/workspace/.mastracode/plans/migration.md">
  {planMarkdown}
</Plan>;
```
